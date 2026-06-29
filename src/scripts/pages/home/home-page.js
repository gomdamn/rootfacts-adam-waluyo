import CameraService from '../../services/camera.service.js';
import DetectionService from '../../services/detection.service.js';
import RootFactsService from '../../services/rootfacts.service.js';
import {
  generateCameraSection,
  generateFooter,
  generateInfoPanel,
} from '../../templates.js';

export default class HomePage {
  #cameraService = new CameraService();
  #detectionService = new DetectionService();
  #rootFactsService = new RootFactsService();
  #predictionTimer = null;
  #isAnalyzing = false;
  #currentFPS = 30;
  #lastLabel = '';
  #lastFact = '';

  async render() {
    return `
      <main class="main-content">
        ${generateCameraSection()}
        ${generateInfoPanel()}
      </main>
      ${generateFooter()}
    `;
  }

  async afterRender() {
    this.#bindElements();
    await this.#initializeModels();
  }

  #bindElements() {
    this.video = document.getElementById('media-video');
    this.canvas = document.getElementById('media-canvas');
    this.cameraSelect = document.getElementById('camera-select');
    this.btnToggle = document.getElementById('btn-toggle');
    this.fpsSlider = document.getElementById('fps-slider');
    this.fpsLabel = document.getElementById('fps-label');
    this.toneSelect = document.getElementById('tone-select');
    this.btnCopy = document.getElementById('btn-copy');
    this.statusText = document.getElementById('status-text');
    this.statusDot = document.getElementById('status-dot');
    this.placeholder = document.getElementById('camera-placeholder');
    this.overlay = document.getElementById('camera-overlay');
    this.idleState = document.getElementById('state-idle');
    this.loadingState = document.getElementById('state-loading');
    this.resultState = document.getElementById('state-result');
    this.detectedName = document.getElementById('detected-name');
    this.detectedConfidence = document.getElementById('detected-confidence');
    this.confidenceFill = document.getElementById('confidence-fill');
    this.funFactText = document.getElementById('fun-fact-text');
    this.funFactLoading = document.getElementById('fun-fact-loading');

    this.btnToggle.addEventListener('click', () => this.#toggleCamera());
    this.fpsSlider.addEventListener('input', (event) => this.#setFPS(event.target.value));
    this.toneSelect.addEventListener('change', () => this.#regenerateFactWithTone());
    this.btnCopy.addEventListener('click', () => this.#copyFact());
    this.cameraSelect.addEventListener('change', () => {
      if (this.#cameraService.isActive()) this.#startCamera();
    });
  }

  async #initializeModels() {
    this.#setHeaderStatus('Menunggu Model... 0%', false);
    this.#showLoading('Menunggu Model Computer Vision... 0%');

    try {
      // Jangan menunggu Transformers.js di awal, karena model teks cukup besar.
      // Kamera dan model TensorFlow.js harus siap lebih dulu agar UI tidak stuck di "Memuat...".
      await this.#detectionService.loadModel((percent, message) => {
        this.#setHeaderStatus(`${message} ${percent}%`, false);
        this.#showLoading(`${message} ${percent}%`);
      });

      await this.#cameraService.loadCameras(this.cameraSelect);
      this.#setHeaderStatus('Siap memindai', true);
      this.#showIdle();

      // Muat Generative AI lokal secara background. Jika gagal/lama, fun fact tetap muncul
      // melalui fallback dinamis sampai Transformers.js selesai siap.
      this.#rootFactsService.loadModel((percent, message) => {
        console.info(`${message} ${percent}%`);
      }).then(() => {
        this.#setHeaderStatus('Siap memindai + AI fun fact', true);
      }).catch((error) => {
        console.warn('Generative AI background loading gagal, fallback tetap aktif.', error);
      });
    } catch (error) {
      console.error(error);
      this.#setHeaderStatus('Model gagal dimuat', false);
      this.#showIdle('Model gagal dimuat. Periksa koneksi awal, lalu muat ulang halaman.');
    }
  }

  async #toggleCamera() {
    if (this.#cameraService.isActive()) {
      this.#stopCamera();
      return;
    }

    await this.#startCamera();
  }

  async #startCamera() {
    try {
      await this.#cameraService.startCamera('media-video', 'media-canvas', this.cameraSelect);
      this.placeholder.classList.add('hidden');
      this.overlay.classList.add('active');
      this.btnToggle.classList.add('scanning');
      this.btnToggle.innerHTML = '<i data-lucide="square" width="24" height="24"></i>';
      this.#setHeaderStatus('Kamera aktif', true);
      this.#showLoading('Menganalisis objek sayuran...');
      this.#startPredictionLoop();
      this.#refreshIcons();
    } catch (error) {
      console.error(error);
      this.#setHeaderStatus('Izin kamera gagal', false);
      this.#showIdle('Aplikasi membutuhkan izin kamera. Pastikan browser mengizinkan akses kamera.');
    }
  }

  #stopCamera() {
    this.#cameraService.stopCamera();
    clearTimeout(this.#predictionTimer);
    this.#predictionTimer = null;
    this.placeholder.classList.remove('hidden');
    this.overlay.classList.remove('active');
    this.btnToggle.classList.remove('scanning');
    this.btnToggle.innerHTML = '<i data-lucide="scan-line" width="24" height="24"></i>';
    this.#setHeaderStatus('Kamera berhenti', false);
    this.#showIdle();
    this.#refreshIcons();
  }

  #setFPS(fps) {
    this.#currentFPS = Number(fps) || 30;
    this.fpsLabel.textContent = `${this.#currentFPS} FPS`;
    this.#cameraService.setFPS(this.#currentFPS);
  }

  #startPredictionLoop() {
    clearTimeout(this.#predictionTimer);

    const loop = async () => {
      if (!this.#cameraService.isActive()) return;
      await this.#predictFrame();
      const delay = Math.max(1000 / this.#currentFPS, 100);
      this.#predictionTimer = setTimeout(loop, delay);
    };

    loop();
  }

  async #predictFrame() {
    if (this.#isAnalyzing || !this.video?.videoWidth) return;
    this.#isAnalyzing = true;

    try {
      const result = await this.#detectionService.predict(this.video);
      this.#renderPrediction(result);
    } catch (error) {
      console.warn('Prediksi gagal:', error);
    } finally {
      this.#isAnalyzing = false;
    }
  }

  async #renderPrediction(result) {
    const { label, confidencePercent } = result;
    const shouldGenerateFact = label !== this.#lastLabel || confidencePercent >= 70;

    this.#lastLabel = label;
    this.detectedName.textContent = label;
    this.detectedConfidence.textContent = `${confidencePercent}%`;
    this.confidenceFill.style.width = `${Math.min(confidencePercent, 100)}%`;
    this.#showResult();

    if (shouldGenerateFact && !this.#rootFactsService.isGenerating) {
      await this.#generateFact(label);
    }
  }

  async #generateFact(label) {
    this.funFactLoading.classList.remove('hidden');
    this.funFactText.textContent = 'Memuat fakta menarik dari Generative AI lokal...';

    const tone = this.toneSelect.value;
    const fact = await this.#rootFactsService.generateFacts(label, tone);
    this.#lastFact = fact;
    this.funFactText.textContent = fact;
    this.funFactLoading.classList.add('hidden');
  }

  async #regenerateFactWithTone() {
    this.#rootFactsService.setTone(this.toneSelect.value);
    if (this.#lastLabel) await this.#generateFact(this.#lastLabel);
  }

  async #copyFact() {
    const text = this.#lastFact || this.funFactText.textContent;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    this.btnCopy.classList.add('copied');
    this.btnCopy.innerHTML = '<i data-lucide="check" width="18" height="18"></i>';
    this.#refreshIcons();
    setTimeout(() => {
      this.btnCopy.classList.remove('copied');
      this.btnCopy.innerHTML = '<i data-lucide="copy" width="18" height="18"></i>';
      this.#refreshIcons();
    }, 1200);
  }

  #showIdle(message = null) {
    this.idleState.classList.remove('hidden');
    this.loadingState.classList.add('hidden');
    this.resultState.classList.add('hidden');
    if (message) this.idleState.querySelector('p').textContent = message;
  }

  #showLoading(message) {
    this.idleState.classList.add('hidden');
    this.loadingState.classList.remove('hidden');
    this.resultState.classList.add('hidden');
    this.loadingState.querySelector('p').textContent = message;
  }

  #showResult() {
    this.idleState.classList.add('hidden');
    this.loadingState.classList.add('hidden');
    this.resultState.classList.remove('hidden');
    this.resultState.classList.add('fadeIn');
  }

  #setHeaderStatus(text, active) {
    this.statusText.textContent = text;
    this.statusDot.classList.toggle('active', active);
  }

  #refreshIcons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}
