// One caller creates offers; the accepted recipient answers. Candidates arriving
// before the remote description are queued. No media is captured on construction.
export class VideoSession {
  constructor({ request, conversationId, call = null, onChange }) {
    this.request = request;
    this.conversationId = conversationId;
    this.call = call;
    this.onChange = onChange;
    this.cursor = "0";
    this.candidates = [];
    this.closed = false;
    this.heartbeatAt = 0;
  }

  update(state) { if (!this.closed) this.onChange(state); }
  api(action, extra = {}) {
    return this.request("/api/direct-video", { method: "POST", body: JSON.stringify({ conversationId: this.conversationId, callId: this.call?.id, action, ...extra }) });
  }

  async preview(video = true) {
    if (!globalThis.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) throw new Error("Your browser cannot make calls here. Open Pawline in a current browser over HTTPS.");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false }); }
    catch (error) {
      if (error.name === "NotAllowedError") throw new Error("Camera or microphone permission was denied. Allow access in your browser, then try again.");
      if (error.name === "NotFoundError") throw new Error("A camera or microphone was not found. Connect a device, or try with the camera off.");
      throw new Error("Your camera or microphone is busy or unavailable. Close other calls and try again.");
    }
    if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = stream;
    this.update({ localStream: stream, phase: "preview", error: "" });
  }

  async join() {
    if (!this.stream) throw new Error("Preview your camera and microphone first.");
    const action = this.call ? "accept" : "start";
    const result = await this.api(action, action === "start" ? { callId: crypto.randomUUID() } : {});
    this.call = result.call;
    this.configuration = result.configuration;
    if (this.closed) { this.api("end").catch(() => {}); return; }
    this.update({ call: this.call, phase: this.call.state === "ringing" ? "ringing" : "connecting" });
    this.monitor();
  }

  monitor() {
    if (this.monitoring || this.closed || !this.call) return;
    this.monitoring = true;
    const tick = async () => {
      try {
        const result = await this.request(`/api/direct-video?conversationId=${encodeURIComponent(this.conversationId)}&callId=${this.call.id}&after=${this.cursor}`);
        if (this.closed) return;
        this.call = result.call;
        this.configuration = result.configuration || this.configuration;
        this.update({ call: this.call });
        if (!["ringing", "accepted"].includes(this.call.state)) {
          this.stopMedia();
          this.update({ phase: this.call.state, localStream: null, remoteStream: null });
          this.monitoring = false;
          return;
        }
        if (this.call.state === "accepted" && !this.call.participant) {
          this.stopMedia();
          this.update({ phase: "answered", localStream: null });
          this.monitoring = false;
          return;
        }
        if (this.call.participant && Date.now() - this.heartbeatAt > 10000) {
          try { await this.api("heartbeat"); }
          catch (error) {
            // A decline/hangup can commit after the status read. Let the next
            // poll show its terminal state rather than reporting a media error.
            if (error.status === 409) {
              if (!this.closed) this.timer = setTimeout(tick, 250);
              return;
            }
            throw error;
          }
          this.heartbeatAt = Date.now();
        }
        if (this.call.state === "accepted" && this.stream) {
          await this.connect();
          for (const signal of result.signals || []) {
            if (this.closed || !this.peer) return;
            await this.receive(signal);
            this.cursor = signal.id;
          }
        }
      } catch (error) { this.fail(error); return; }
      if (!this.closed) this.timer = setTimeout(tick, 1500);
    };
    tick();
  }

  async signal(kind, payload) {
    const signalId = crypto.randomUUID();
    await this.api("signal", { kind, payload, signalId });
  }

  async connect() {
    if (this.peer || this.closed) return;
    const peer = new RTCPeerConnection({ iceServers: this.configuration?.iceServers || [], iceTransportPolicy: this.configuration?.iceTransportPolicy || "relay" });
    this.peer = peer;
    this.update({ phase: "connecting" });
    this.connectTimer = setTimeout(() => this.fail(new Error("The call could not connect. Check your connection and try again.")), 30000);
    peer.onicecandidate = event => {
      if (event.candidate && !this.closed) this.signal("candidate", event.candidate.toJSON()).catch(error => this.fail(error));
    };
    peer.ontrack = event => this.update({ remoteStream: event.streams[0] });
    peer.onconnectionstatechange = () => {
      if (this.closed) return;
      if (peer.connectionState === "connected") {
        clearTimeout(this.connectTimer);
        clearTimeout(this.disconnectTimer);
        this.update({ phase: "connected" });
      } else if (peer.connectionState === "failed") this.fail(new Error("The connection was lost. You can start another call."));
      else if (peer.connectionState === "disconnected") {
        this.update({ phase: "reconnecting" });
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = setTimeout(() => this.fail(new Error("The other person disconnected. You can start another call.")), 10000);
      }
    };
    this.stream.getTracks().forEach(track => peer.addTrack(track, this.stream));
    if (this.call.mine) {
      await peer.setLocalDescription(await peer.createOffer());
      if (!this.closed && this.peer === peer) await this.signal("offer", peer.localDescription.toJSON());
    }
  }

  async receive(signal) {
    const peer = this.peer;
    if (signal.kind === "candidate") {
      if (peer.remoteDescription) await peer.addIceCandidate(signal.payload);
      else this.candidates.push(signal.payload);
      return;
    }
    await peer.setRemoteDescription(signal.payload);
    for (const candidate of this.candidates.splice(0)) await peer.addIceCandidate(candidate);
    if (signal.kind === "offer") {
      await peer.setLocalDescription(await peer.createAnswer());
      await this.signal("answer", peer.localDescription.toJSON());
    }
  }

  toggle(kind, enabled) { this.stream?.getTracks().filter(track => track.kind === kind).forEach(track => { track.enabled = enabled; }); }
  stopMedia() {
    clearTimeout(this.timer);
    clearTimeout(this.connectTimer);
    clearTimeout(this.disconnectTimer);
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.onconnectionstatechange = null;
      this.peer.ontrack = null;
      this.peer.close();
      this.peer = null;
    }
  }
  fail(error) {
    if (this.closed || this.failed) return;
    this.failed = true;
    this.stopMedia();
    this.update({ phase: "error", error: error.message, localStream: null, remoteStream: null });
    if (this.call?.participant) this.api("end").catch(() => {});
  }
  async decline() {
    const result = await this.api("decline");
    this.call = result.call;
    this.stopMedia();
    this.update({ phase: "declined" });
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.stopMedia();
    if (this.call?.participant && ["ringing", "accepted"].includes(this.call.state)) this.api("end").catch(() => {});
  }
}
