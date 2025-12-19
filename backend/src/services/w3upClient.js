let clientPromise;

async function getW3upClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const Client = await import('@storacha/client');
      const client = await Client.create();

      const targetSpaceName = process.env.W3UP_SPACE_NAME || 'Oghenekparobo';
      const spaces = client.spaces();
      const targetSpace = spaces.find((s) => s.name() === targetSpaceName);

      if (targetSpace) {
        await client.setCurrentSpace(targetSpace.did());
      }

      return client;
    })();
  }
  return clientPromise;
}

module.exports = { getW3upClient };
