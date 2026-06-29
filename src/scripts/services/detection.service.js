class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.imageSize = 224;
    this.currentBackend = 'webgl';
    this.performanceStats = {
      operations: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }

  async #waitForTF(timeoutMs = 15000) {
    const start = Date.now();
    while (!window.tf) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('TensorFlow.js belum berhasil dimuat dari CDN. Periksa koneksi internet awal.');
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return window.tf;
  }

  async #setBestBackend(tf) {
    const hasWebGPU = Boolean(navigator.gpu && tf.findBackend?.('webgpu'));
    const candidates = hasWebGPU ? ['webgpu', 'webgl', 'cpu'] : ['webgl', 'cpu'];

    for (const backend of candidates) {
      try {
        await tf.setBackend(backend);
        await tf.ready();
        this.currentBackend = backend;
        return backend;
      } catch (error) {
        console.warn(`Backend ${backend} tidak tersedia, mencoba fallback.`, error);
      }
    }

    await tf.setBackend('cpu');
    await tf.ready();
    this.currentBackend = 'cpu';
    return 'cpu';
  }

  async loadModel(onProgress = () => {}) {
    onProgress(5, 'Menyiapkan TensorFlow.js...');
    const tf = await this.#waitForTF();

    onProgress(15, 'Menyiapkan backend AI...');
    await this.#setBestBackend(tf);

    onProgress(30, 'Memuat metadata sayuran...');
    const metadataResponse = await fetch('/model/metadata.json', { cache: 'no-cache' });
    if (!metadataResponse.ok) throw new Error('metadata.json gagal dimuat.');
    const metadata = await metadataResponse.json();
    this.labels = metadata.labels || [];
    this.imageSize = metadata.imageSize || 224;

    onProgress(60, 'Menunggu Model Computer Vision...');
    this.model = await tf.loadLayersModel('/model/model.json');

    tf.tidy(() => {
      const dummy = tf.zeros([1, this.imageSize, this.imageSize, 3]);
      this.model.predict(dummy);
    });

    onProgress(100, `Model siap (${this.currentBackend.toUpperCase()})`);
    return this.model;
  }

  async predict(imageElement) {
    if (!this.model) throw new Error('Model belum dimuat.');
    const tf = window.tf;
    const start = performance.now();

    const scores = tf.tidy(() => {
      const tensor = tf.browser
        .fromPixels(imageElement)
        .resizeBilinear([this.imageSize, this.imageSize])
        .toFloat()
        .div(127.5)
        .sub(1)
        .expandDims(0);

      const prediction = this.model.predict(tensor);
      return prediction.dataSync();
    });

    let bestIndex = 0;
    let bestScore = scores[0] || 0;
    scores.forEach((score, index) => {
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const end = performance.now();
    this.performanceStats.operations += 1;
    this.performanceStats.totalTime += end - start;
    this.performanceStats.averageTime = this.performanceStats.totalTime / this.performanceStats.operations;

    return {
      label: this.labels[bestIndex] || 'Unknown vegetable',
      confidence: bestScore,
      confidencePercent: Math.round(bestScore * 100),
      backend: this.currentBackend,
      scores: Array.from(scores),
    };
  }
}

export default DetectionService;
