// SDK boundary fake for automated UI lifecycle checks. This is not media proof.
export default {
  createFrame(container) {
    const iframe = document.createElement('iframe');
    iframe.title = 'Simulated Daily frame'; container.append(iframe);
    const events = {};
    return {
      iframe: () => iframe,
      on: (event, handler) => { events[event] = handler; },
      join: async ({ url, token }) => {
        if (!url.startsWith('https://pawline-test.daily.co/pawline-') || token !== 'fixture-token') throw new Error('Invalid fixture access');
        container.dataset.simulatedCall = 'joined';
        events['joined-meeting']?.();
      },
      destroy: async () => { delete container.dataset.simulatedCall; iframe.remove(); },
    };
  },
};
