// ponytail: stub providers — real implementations in audio-provider.mjs, image-provider.mjs, brand-provider.mjs
// each provider: { search(intent, opts): Promise<{url, localPath?, metadata}|null>, generate?(intent, opts): Promise<{url, localPath?, metadata}|null> }

function stubProvider(type) {
  return {
    async search() {
      return null;
    },
    async generate() {
      return null;
    },
    type,
  };
}

const registry = {
  bgm: stubProvider("bgm"),
  sfx: stubProvider("sfx"),
  voice: stubProvider("voice"),
  image: stubProvider("image"),
  icon: stubProvider("icon"),
  brand: stubProvider("brand"),
};

export function getProvider(type) {
  const p = registry[type];
  if (!p) throw new Error(`unknown media type: ${type}`);
  return p;
}

export function registerProvider(type, provider) {
  registry[type] = { ...provider, type };
}

export function listTypes() {
  return Object.keys(registry);
}
