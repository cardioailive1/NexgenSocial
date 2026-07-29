// The single most important config value for a self-hosted SFU:
// MEDIASOUP_ANNOUNCED_IP must be the server's real public IP address.
// mediasoup binds its media sockets to 0.0.0.0 internally, but it tells
// each browser "send your media to THIS IP" via ICE candidates -- if that
// IP isn't actually reachable from the public internet (e.g. it's still
// 127.0.0.1, or a private/container-internal IP), every connection will
// fail ICE negotiation silently. Set this explicitly; don't rely on the
// default. See the README for why a typical Render web service can't host
// this piece.
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1";
const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0";

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }],
    enableUdp: true,
    enableTcp: true, // TCP fallback for networks that block UDP outright
    preferUdp: true,
    initialAvailableOutgoingBitrate: 800000,
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

module.exports = { createWebRtcTransport, ANNOUNCED_IP };
