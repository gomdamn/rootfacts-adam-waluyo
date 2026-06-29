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
  #isResultLocked = false;
  #generationId = 0;
  #minimumConfidence = 0.40;
  #captureMode = 'idle'; // idle -> preview -> locked

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

    this.btnToggle.addEventListener('click', () => this.#handleScanButton());
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
      await this.#detectionService.loadModel((percent, message) => {
        this.#setHeaderStatus(`${message} ${percent}%`, false);
        this.#showLoading(`${message} ${percent}%`);
      });

      await this.#cameraService.loadCameras(this.cameraSelect);
      this.#setHeaderStatus('Siap memindai', true);
      this.#showIdle();

      this.#rootFactsService.loadModel((percent, message) => {
        console.info(`${message} ${percent}%`);
      }).then(() => {
        this.#setHeaderStatus('Siap memindai + AI Xenova', true);
      }).catch((error) => {
        console.warn('Model generatif Xenova akan dimuat ulang saat dibutuhkan.', error);
      });
    } catch (error) {
      console.error(error);
      this.#setHeaderStatus('Model gagal dimuat', false);
      this.#showIdle('Model gagal dimuat. Periksa koneksi awal, lalu muat ulang halaman.');
    }
  }

  async #handleScanButton() {
    // Alur revisi reviewer:
    // 1) klik pertama: webcam menyala sebagai preview saja.
    // 2) klik kedua: ambil frame/foto, matikan webcam, lalu inference + fun fact.
    // 3) setelah hasil tampil, klik lagi untuk scan ulang dari awal.
    if (this.#isResultLocked) {
      this.#clearResultMemory();
      await this.#startCamera();
      return;
    }

    if (this.#cameraService.isActive()) {
      await this.#capturePhotoAndAnalyze();
      return;
    }

    await this.#startCamera();
  }

  async #startCamera() {
    try {
      this.#clearResultMemory();
      this.video.classList.remove('hidden');
      this.canvas.classList.add('hidden');

      await this.#cameraService.startCamera('media-video', 'media-canvas', this.cameraSelect);
      this.placeholder.classList.add('hidden');
      this.overlay.classList.add('active');
      this.#captureMode = 'preview';
      this.btnToggle.classList.add('scanning');
      this.btnToggle.innerHTML = '<i data-lucide="camera" width="24" height="24"></i>';
      this.#setHeaderStatus('Kamera aktif - tekan tombol kamera untuk ambil foto', true);
      this.#showIdle('Arahkan kamera ke sayuran, lalu tekan tombol kamera untuk mengambil foto dan memulai analisis.');
      this.#refreshIcons();
    } catch (error) {
      console.error(error);
      this.#setHeaderStatus('Izin kamera gagal', false);
      this.#showIdle('Aplikasi membutuhkan izin kamera. Pastikan browser mengizinkan akses kamera.');
    }
  }

  #stopCameraAndReset() {
    this.#cameraService.stopCamera();
    clearTimeout(this.#predictionTimer);
    this.#predictionTimer = null;
    this.#isAnalyzing = false;
    this.#isResultLocked = false;
    this.#captureMode = 'idle';
    this.video.classList.remove('hidden');
    this.canvas.classList.add('hidden');
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


  async #capturePhotoAndAnalyze() {
    if (!this.#cameraService.isActive() || !this.video?.videoWidth) return;

    this.#captureMode = 'locked';
    this.#isResultLocked = true;
    clearTimeout(this.#predictionTimer);
    this.#predictionTimer = null;
    this.#generationId += 1;

    // Simpan frame terakhir ke canvas agar gambar tetap terlihat setelah webcam dimatikan.
    this.#captureCurrentFrame();
    this.#cameraService.stopCamera();
    this.overlay.classList.remove('active');
    this.placeholder.classList.add('hidden');
    this.btnToggle.classList.remove('scanning');
    this.btnToggle.innerHTML = '<i data-lucide="rotate-cw" width="24" height="24"></i>';
    this.#setHeaderStatus('Foto diambil - sedang menganalisis', true);
    this.#showLoading('Menganalisis foto sayuran...');
    this.#refreshIcons();

    try {
      const result = await this.#detectionService.predict(this.canvas);
      const { label, confidence, confidencePercent } = result;
      this.#lastLabel = label;
      this.#updateResultHeader(label, confidencePercent);
      this.#setHeaderStatus('Hasil terdeteksi - tekan untuk scan ulang', true);
      this.#showResult();
      this.#refreshIcons();

      if (confidence < this.#minimumConfidence) {
        this.funFactLoading.classList.add('hidden');
        this.funFactText.textContent = `${label}: hasil prediksi masih rendah (${confidencePercent}%). Tekan scan ulang dan ambil foto objek sayuran lebih dekat.`;
        this.#lastFact = this.funFactText.textContent;
        return;
      }

      await this.#generateFact(label);
    } catch (error) {
      console.error('Analisis foto gagal:', error);
      this.#setHeaderStatus('Analisis gagal - tekan untuk scan ulang', false);
      this.#showResult();
      this.funFactLoading.classList.add('hidden');
      this.funFactText.textContent = 'Analisis foto gagal. Tekan tombol scan ulang, lalu ambil foto lagi.';
    }
  }

  #startPredictionLoop() {
    clearTimeout(this.#predictionTimer);

    const loop = async () => {
      if (!this.#cameraService.isActive() || this.#isResultLocked) return;
      await this.#predictFrame();
      const delay = Math.max(1000 / this.#currentFPS, 120);
      this.#predictionTimer = setTimeout(loop, delay);
    };

    loop();
  }

  async #predictFrame() {
    if (this.#isAnalyzing || !this.video?.videoWidth || this.#isResultLocked) return;
    this.#isAnalyzing = true;

    try {
      const result = await this.#detectionService.predict(this.video);
      await this.#handlePrediction(result);
    } catch (error) {
      console.warn('Prediksi gagal:', error);
    } finally {
      this.#isAnalyzing = false;
    }
  }

  async #handlePrediction(result) {
    const { label, confidence, confidencePercent } = result;
    this.#lastLabel = label;
    this.#updateResultHeader(label, confidencePercent);

    if (confidence < this.#minimumConfidence) {
      this.#showLoading(`Prediksi ${label} masih kurang yakin (${confidencePercent}%). Dekatkan kamera ke objek.`);
      return;
    }

    // Kunci hasil pertama yang confidence-nya cukup tinggi agar deskripsi tidak berubah-ubah.
    // Setelah hasil dikunci, webcam dimatikan dan frame terakhir dipertahankan di canvas.
    await this.#lockResultAndGenerateFact(result);
  }

  async #lockResultAndGenerateFact(result) {
    if (this.#isResultLocked) return;

    this.#isResultLocked = true;
    clearTimeout(this.#predictionTimer);
    this.#predictionTimer = null;

    const { label, confidencePercent } = result;
    this.#updateResultHeader(label, confidencePercent);
    this.#captureCurrentFrame();
    this.#cameraService.stopCamera();

    this.overlay.classList.remove('active');
    this.placeholder.classList.add('hidden');
    this.btnToggle.classList.remove('scanning');
    this.btnToggle.innerHTML = '<i data-lucide="rotate-cw" width="24" height="24"></i>';
    this.#setHeaderStatus('Hasil terdeteksi - tekan untuk scan ulang', true);
    this.#showResult();
    this.#refreshIcons();

    await this.#generateFact(label);
  }

  #captureCurrentFrame() {
    if (!this.video?.videoWidth || !this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    this.video.classList.add('hidden');
    this.canvas.classList.remove('hidden');
  }

  async #generateFact(label) {
    const generationId = ++this.#generationId;
    const tone = this.toneSelect.value;

    this.funFactLoading.classList.remove('hidden');
    this.funFactText.textContent = `Membuat fun fact tentang ${label} menggunakan model Xenova/Transformers.js...`;

    const fact = await this.#rootFactsService.generateFacts(label, tone, (message) => {
      if (generationId === this.#generationId) {
        this.funFactText.textContent = message;
      }
    });

    if (generationId !== this.#generationId) return;

    this.#lastFact = fact;
    this.funFactText.textContent = fact;
    this.funFactLoading.classList.add('hidden');
  }

  async #regenerateFactWithTone() {
    this.#rootFactsService.setTone(this.toneSelect.value);
    if (!this.#isResultLocked || !this.#lastLabel) return;
    await this.#generateFact(this.#lastLabel);
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

  #clearResultMemory() {
    this.#generationId += 1;
    this.#isResultLocked = false;
    this.#lastLabel = '';
    this.#lastFact = '';
    this.#captureMode = 'idle';
    this.funFactLoading?.classList.add('hidden');
    if (this.funFactText) this.funFactText.textContent = 'Fakta menarik akan muncul di sini...';
    if (this.detectedName) this.detectedName.textContent = 'Sayuran';
    if (this.detectedConfidence) this.detectedConfidence.textContent = '0%';
    if (this.confidenceFill) this.confidenceFill.style.width = '0%';
  }

  #updateResultHeader(label, confidencePercent) {
    this.detectedName.textContent = label;
    this.detectedConfidence.textContent = `${confidencePercent}%`;
    this.confidenceFill.style.width = `${Math.min(confidencePercent, 100)}%`;
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
