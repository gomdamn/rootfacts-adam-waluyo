class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = {
      fps: 30,
      width: { ideal: 640 },
      height: { ideal: 480 },
    };
  }

  initializeElements(videoId, canvasId) {
    this.video = document.getElementById(videoId);
    this.canvas = document.getElementById(canvasId);
  }

  async loadCameras(cameraSelect) {
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error('MediaStream API tidak tersedia di browser ini.');
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');

      if (!cameraSelect) return videoDevices;

      cameraSelect.innerHTML = '';
      if (videoDevices.length === 0) {
        cameraSelect.innerHTML = '<option value="">Kamera default</option>';
        return videoDevices;
      }

      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Kamera ${index + 1}`;
        cameraSelect.appendChild(option);
      });

      return videoDevices;
    } catch (error) {
      console.warn('Gagal membaca daftar kamera:', error);
      return [];
    }
  }

  async startCamera(videoId, canvasId, cameraSelect) {
    this.initializeElements(videoId, canvasId);
    this.stopCamera();

    const selectedDevice = cameraSelect?.value;
    const constraints = {
      video: selectedDevice
        ? {
            deviceId: { exact: selectedDevice },
            width: this.config.width,
            height: this.config.height,
            frameRate: { ideal: this.config.fps, max: this.config.fps },
          }
        : {
            facingMode: { ideal: 'environment' },
            width: this.config.width,
            height: this.config.height,
            frameRate: { ideal: this.config.fps, max: this.config.fps },
          },
      audio: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;

    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        resolve();
      };
    });

    await this.loadCameras(cameraSelect);
    return this.stream;
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
  }

  setFPS(fps) {
    this.config.fps = Number(fps) || 30;
  }

  isActive() {
    return Boolean(this.stream && this.stream.active);
  }
}

export default CameraService;
