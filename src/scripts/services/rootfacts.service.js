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
    if (this.generator) return this.generator;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.#loadModelInternal(onProgress);
    return this.loadingPromise;
  }

  async #loadModelInternal(onProgress = () => {}) {
    onProgress(5, 'Preparing Xenova Generative AI model...');

    const { env, pipeline } = await import(
      /* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js'
    );

    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;
    env.backends.onnx.wasm.numThreads = 1;

    onProgress(25, `Loading ${this.modelId}...`);

    this.generator = await pipeline('text2text-generation', this.modelId, {
      dtype: 'q4',
      device: 'wasm',
      progress_callback: (progress) => {
        const fileProgress = progress?.progress ? Math.round(progress.progress) : 0;
        const percent = Math.min(95, 30 + Math.round(fileProgress * 0.6));
        onProgress(percent, `Loading Xenova/Transformers.js ${fileProgress}%...`);
      },
    });

    this.currentBackend = 'wasm';
    this.isModelLoaded = true;
    onProgress(100, 'Xenova Generative AI is ready');
    return this.generator;
  }

  setTone(tone) {
    this.currentTone = tone || 'normal';
  }

  #sanitizeInput(text) {
    return String(text || '')
      .replace(/[^a-zA-Z\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
  }

  #toneInstruction(tone) {
    const tones = {
      normal: 'Use a clear and friendly tone.',
      funny: 'Use a playful but factual tone.',
      professional: 'Use a concise educational tone.',
      casual: 'Use a relaxed everyday tone.',
      sejarah: 'Mention a short history or traditional use if relevant.',
    };
    return tones[tone] || tones.normal;
  }

  #buildPrompt(vegetable, tone, attempt = 1) {
    const style = this.#toneInstruction(tone);

    if (attempt === 1) {
      return [
        `Write one useful fun fact about ${vegetable}.`,
        `The sentence must only discuss ${vegetable}.`,
        `Mention nutrition, benefits, characteristics, history, or common uses.`,
        style,
        `Use English. Keep it under 30 words.`,
      ].join(' ');
    }

    return [
      `Vegetable: ${vegetable}.`,
      `Task: produce exactly one factual sentence about ${vegetable} only.`,
      `Do not mention other vegetables.`,
      `Use English. Make it readable and informative.`,
      `Maximum 25 words.`,
    ].join(' ');
  }

  #extractGeneratedText(output) {
    if (Array.isArray(output)) {
      return output[0]?.generated_text || output[0]?.summary_text || output[0]?.text || '';
    }
    return output?.generated_text || output?.summary_text || output?.text || '';
  }

  #normalizeText(text, prompt, vegetable) {
    let cleaned = String(text || '')
      .replace(prompt, '')
      .replace(/^(fun fact:|fact:|answer:|output:)/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const firstSentence = cleaned.match(/^.*?[.!?](\s|$)/);
    if (firstSentence) cleaned = firstSentence[0].trim();

    if (cleaned && !cleaned.toLowerCase().includes(vegetable.toLowerCase())) {
      cleaned = `${vegetable}: ${cleaned}`;
    }

    if (cleaned && !/[.!?]$/.test(cleaned)) cleaned += '.';
    return cleaned;
  }

  #isRelevantAndReadable(text, vegetable) {
    const cleaned = String(text || '').trim();
    if (cleaned.length < 25) return false;
    if (!cleaned.toLowerCase().includes(vegetable.toLowerCase())) return false;

    const words = cleaned.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length < 6) return false;

    let repeatRun = 1;
    for (let i = 1; i < words.length; i += 1) {
      repeatRun = words[i] === words[i - 1] ? repeatRun + 1 : 1;
      if (repeatRun >= 3) return false;
    }

    const uniqueRatio = new Set(words).size / words.length;
    if (uniqueRatio < 0.45) return false;

    const invalidFragments = ['saat saat', 'numa', 'undefined', 'null', 'lorem ipsum'];
    if (invalidFragments.some((fragment) => cleaned.toLowerCase().includes(fragment))) return false;

    return true;
  }

  async #generateWithPrompt(generator, prompt) {
    const output = await generator(prompt, {
      max_new_tokens: 65,
      temperature: 0.8,
      top_p: 0.9,
      do_sample: true,
      repetition_penalty: 1.25,
      no_repeat_ngram_size: 3,
    });
    return this.#extractGeneratedText(output);
  }

  async generateFacts(vegetable, tone = this.currentTone, onProgress = () => {}) {
    const safeVegetable = this.#sanitizeInput(vegetable);
    if (!safeVegetable) return 'The detected vegetable label is not clear enough yet.';

    this.isGenerating = true;

    try {
      onProgress(`Loading Xenova model for ${safeVegetable}...`);
      const generator = await this.loadModel((percent, message) => {
        onProgress(`${message} ${percent}%`);
      });

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const prompt = this.#buildPrompt(safeVegetable, tone, attempt);
        onProgress(`Generating a Xenova fun fact about ${safeVegetable}...`);
        const generatedText = await this.#generateWithPrompt(generator, prompt);
        const cleanedText = this.#normalizeText(generatedText, prompt, safeVegetable);

        if (this.#isRelevantAndReadable(cleanedText, safeVegetable)) {
          return cleanedText;
        }

        console.warn('Xenova output rejected and retried:', cleanedText);
      }

      return `Xenova generated unreadable text for ${safeVegetable}. Press scan again and keep ${safeVegetable} steady in the camera.`;
    } catch (error) {
      console.error('Generative AI Xenova failed:', error);
      return `Xenova could not generate a fun fact for ${safeVegetable}. Reload the page with internet access and scan again.`;
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded && Boolean(this.generator);
  }
}

export default RootFactsService;
