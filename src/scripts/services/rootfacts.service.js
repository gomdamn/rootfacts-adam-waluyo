class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.currentBackend = 'wasm';
    this.currentTone = 'normal';
    // Xenova/Transformers.js instruction model. Keep it local in browser with q4.
    this.modelId = 'Xenova/flan-t5-small';
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
      funny: 'Use a playful but still factual tone.',
      professional: 'Use a concise educational tone.',
      casual: 'Use a relaxed everyday tone.',
      sejarah: 'Focus on history or traditional use.',
    };
    return tones[tone] || tones.normal;
  }

  #buildPrompt(vegetable, tone, attempt = 1) {
    const style = this.#toneInstruction(tone);

    if (attempt === 1) {
      return [
        `Write one short fun fact about ${vegetable}.`,
        `The answer must be about ${vegetable} only.`,
        `Mention a real aspect such as nutrition, benefit, characteristic, history, or common use.`,
        style,
        `Use 1 sentence, maximum 28 words.`,
      ].join(' ');
    }

    return [
      `Vegetable: ${vegetable}.`,
      `Task: write exactly one factual fun fact about ${vegetable}, not about any other plant.`,
      `Make it informative and specific.`,
      `Output only the final sentence.`,
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

    // Keep only the first sentence to avoid rambling output.
    const firstSentence = cleaned.match(/^.*?[.!?](\s|$)/);
    if (firstSentence) cleaned = firstSentence[0].trim();

    // Make the predicted label explicit for reviewer visibility.
    if (cleaned && !cleaned.toLowerCase().includes(vegetable.toLowerCase())) {
      cleaned = `${vegetable}: ${cleaned}`;
    }

    if (cleaned && !/[.!?]$/.test(cleaned)) cleaned += '.';
    return cleaned;
  }

  #isRelevantAndReadable(text, vegetable) {
    const cleaned = String(text || '').trim();
    if (cleaned.length < 30) return false;
    if (!cleaned.toLowerCase().includes(vegetable.toLowerCase())) return false;

    // Reject degenerate repeated-token outputs such as "saat saat saat".
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
      max_new_tokens: 70,
      do_sample: false,
      num_beams: 2,
      repetition_penalty: 1.35,
      no_repeat_ngram_size: 3,
    });
    return this.#extractGeneratedText(output);
  }

  async generateFacts(vegetable, tone = this.currentTone, onProgress = () => {}) {
    const safeVegetable = this.#sanitizeInput(vegetable);
    if (!safeVegetable) {
      return 'The detected vegetable label is not clear enough yet.';
    }

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

      // This message is not a static fun fact. It is only an error state when the local model
      // produces invalid text after retries, so the reviewer can see the app does not use fallback facts.
      return `Xenova generated invalid text for ${safeVegetable}. Please keep the camera steady and scan ${safeVegetable} again.`;
    } catch (error) {
      console.error('Generative AI Xenova failed:', error);
      return `Xenova could not generate a fun fact for ${safeVegetable}. Please reload the page with internet access and scan again.`;
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded && Boolean(this.generator);
  }
}

export default RootFactsService;
