import React, { useState } from "react";
import CaregiverHub, { CaregiverWelcome } from "../src/CaregiverHub.jsx";
import { SubmissionForm } from "../src/App.jsx";
import Workspace from "../src/DirectMessagesWorkspace.jsx";
import { users } from "./fixture-users.js";

const params = new URL(location.href).searchParams;
const user = params.get("user") || "adopter";
const getToken = async () => `fixture:${user}`;
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: "Bearer fixture:" + user } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
};
export default function CaregiverFixture() {
  const [listing, setListing] = useState(null);
  const [messages, setMessages] = useState(false);
  if (params.has("welcome")) return <CaregiverWelcome onSignIn={() => {}} onSignUp={() => {}} />;
  return <div className="app map-app"><main className="map-workspace panel-shelter"><aside className="map-rail"><div className="rail-content">
    {messages ? <Workspace request={request} userId={users[user].id} onBrowse={() => setMessages(false)} /> : <CaregiverHub key={listing ? "listing" : "workspace"} getToken={getToken} onListPet={setListing} onOpenMessages={() => setMessages(true)} />}
    {listing ? <SubmissionForm caregiver={listing} getToken={getToken} onClose={() => setListing(null)} /> : null}
  </div></aside></main></div>;
}
