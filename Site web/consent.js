(() => {
  'use strict';

  const requiredPurposes = ['1', '3', '4'];
  const googleVendorId = '755';
  let state = { ready: false, advertising: false, reason: 'cmp-unavailable' };

  const publish = next => {
    state = { ...state, ...next };
    window.TamusniConsent = { getState: () => state };
    window.dispatchEvent(new CustomEvent('tamusni-consent-ready', { detail: state }));
  };

  const advertisingAllowed = tcData => {
    const purposes = tcData?.purpose?.consents || {};
    const vendors = tcData?.vendor?.consents || {};
    return requiredPurposes.every(id => purposes[id] === true) && vendors[googleVendorId] === true;
  };

  // A certified IAB TCF CMP owns the visible consent interface. This bridge
  // consumes its API only; it never treats local storage as consent.
  const connect = () => {
    if (typeof window.__tcfapi !== 'function') {
      publish({ ready: true, advertising: false, reason: 'cmp-unavailable' });
      return;
    }
    window.__tcfapi('addEventListener', 2, (tcData, success) => {
      const settled = ['tcloaded', 'useractioncomplete'].includes(tcData?.eventStatus);
      if (!success || !settled) return;
      const advertising = advertisingAllowed(tcData);
      publish({ ready: true, advertising, reason: advertising ? 'consented' : 'declined' });
    });
  };

  connect();
})();
