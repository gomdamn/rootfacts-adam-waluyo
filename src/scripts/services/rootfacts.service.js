const LOCAL_FUN_FACTS = {
  Beetroot: 'Beetroot gets its deep red color from betalain pigments, and those pigments are also used as natural food coloring.',
  Paprika: 'Paprika is made from dried peppers, and its flavor can range from sweet and mild to smoky and spicy.',
  Cabbage: 'Cabbage has been cultivated for thousands of years and is naturally rich in vitamin C and fiber.',
  Carrot: 'Carrots are famous for beta-carotene, a pigment that the body can convert into vitamin A.',
  Cauliflower: 'Cauliflower belongs to the same plant family as broccoli, cabbage, and kale: the Brassica family.',
  Chilli: 'Chilli peppers contain capsaicin, the compound that creates their hot sensation.',
  Corn: 'Corn is technically a grain, but it is often enjoyed as a vegetable when harvested young and sweet.',
  Cucumber: 'Cucumbers are mostly water, which is why they taste refreshing and crisp.',
  eggplant: 'Eggplant is botanically a berry, even though it is usually cooked like a vegetable.',
  Garlic: 'Garlic releases its strong aroma when crushed because sulfur compounds are activated.',
  Ginger: 'Ginger is a rhizome, an underground stem, and it has been used in food and traditional remedies for centuries.',
  Lettuce: 'Lettuce leaves are delicate because they contain lots of water and very little fat.',
  Onion: 'Onions can make people cry because cutting them releases sulfur-containing compounds into the air.',
  Peas: 'Peas are tiny seeds inside pods, and they naturally add protein and sweetness to meals.',
  Potato: 'Potatoes are underground tubers and became one of the world’s most important staple foods.',
  Turnip: 'Turnips can be eaten from root to leaves, making them a versatile crop.',
  Soybean: 'Soybeans are protein-rich legumes used to make tofu, tempeh, soy milk, and many other foods.',
  Spinach: 'Spinach is leafy, fast-cooking, and known for iron, folate, and vitamin K.',
};

class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.currentBackend = 'wasm';
    this.currentTone = 'normal';
    this.modelId = 'Xenova/LaMini-Flan-T5-77M';
    this.loadingPromise = null;
  }

  async loadModel(onProgress = () => {}) {
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.#loadModelInternal(onProgress);
    return this.loadingPromise;
  }

  async #loadModelInternal(onProgress = () => {}) {
    try {
      onProgress(10, 'Menyiapkan Generative AI lokal...');

      const { env, pipeline } = await import(
        /* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js'
      );

      env.allowLocalModels = false;
      env.useBrowserCache = true;

      const device = navigator.gpu ? 'webgpu' : 'wasm';
      this.currentBackend = device;
      onProgress(45, `Memuat Transformers.js (${device})...`);

      try {
        this.generator = await pipeline('text2text-generation', this.modelId, {
          dtype: 'q4',
          device,
        });
      } catch (gpuError) {
        console.warn('Generative AI fallback ke WASM.', gpuError);
        this.currentBackend = 'wasm';
        this.generator = await pipeline('text2text-generation', this.modelId, {
          dtype: 'q4',
          device: 'wasm',
        });
      }

      this.isModelLoaded = true;
      onProgress(100, `Generative AI siap (${this.currentBackend.toUpperCase()})`);
      return this.generator;
    } catch (error) {
      console.warn('Model generatif gagal dimuat. Fallback lokal digunakan.', error);
      this.generator = null;
      this.isModelLoaded = true;
      onProgress(100, 'Fallback fun fact siap');
      return null;
    }
  }

  setTone(tone) {
    this.currentTone = tone || 'normal';
  }

  #sanitizeInput(text) {
    return String(text || '')
      .replace(/[^a-zA-Z\s-]/g, '')
      .trim()
      .slice(0, 40);
  }

  #toneInstruction(tone) {
    const tones = {
      normal: 'Write in a clear and friendly tone.',
      funny: 'Write in a playful and funny tone suitable for teenagers.',
      professional: 'Write in a concise educational tone for a nutrition class.',
      casual: 'Write in a relaxed everyday tone.',
      sejarah: 'Write with a historical storytelling angle.',
    };
    return tones[tone] || tones.normal;
  }

  #fallbackFact(safeVegetable, tone) {
    const baseFact = LOCAL_FUN_FACTS[safeVegetable] || `${safeVegetable} has unique nutrients and culinary uses that make it valuable in everyday meals.`;
    if (tone === 'funny') return `${baseFact} Pretty impressive for a humble vegetable, right?`;
    if (tone === 'professional') return `${baseFact} This makes it useful as part of a varied and balanced diet.`;
    if (tone === 'casual') return `${baseFact} Jadi, sayuran ini ternyata punya cerita menarik juga.`;
    if (tone === 'sejarah') return `${baseFact} Its long journey in food culture shows how vegetables can shape daily life across generations.`;
    return baseFact;
  }

  async generateFacts(vegetable, tone = this.currentTone) {
    const safeVegetable = this.#sanitizeInput(vegetable);
    if (!safeVegetable) return 'Sayuran belum terdeteksi dengan jelas. Coba arahkan kamera ke objek sayuran.';

    // Mulai load Transformers.js, tapi jangan memblokir UI terlalu lama.
    if (!this.loadingPromise) this.loadModel();
    if (!this.generator) return this.#fallbackFact(safeVegetable, tone);

    this.isGenerating = true;
    const prompt = `Generate one unique fun fact about ${safeVegetable}. ${this.#toneInstruction(tone)} Keep it under 45 words. Do not use markdown.`;

    try {
      const output = await this.generator(prompt, {
        max_new_tokens: 80,
        temperature: tone === 'funny' ? 0.9 : 0.7,
        top_p: 0.9,
        do_sample: true,
      });

      const generated = Array.isArray(output)
        ? output[0]?.generated_text || output[0]?.summary_text || ''
        : output?.generated_text || '';

      const clean = String(generated).replace(prompt, '').trim();
      if (clean.length > 20) return clean;
    } catch (error) {
      console.warn('Gagal membuat fun fact dengan Transformers.js, memakai fallback.', error);
    } finally {
      this.isGenerating = false;
    }

    return this.#fallbackFact(safeVegetable, tone);
  }

  isReady() {
    return this.isModelLoaded;
  }
}

export default RootFactsService;
