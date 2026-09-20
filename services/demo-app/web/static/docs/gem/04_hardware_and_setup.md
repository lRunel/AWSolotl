# Hardware & Setup

Gem requires a local microphone and a webcam to operate efficiently. This document covers setup, calibration, and wake word customization.

## 1. Automated Installation (Fedora Linux)

A provided `install.sh` script automates the installation process on Fedora-based distributions.
It will:
- Install system dependencies (`python3-devel`, `pipewire-pulseaudio`, `portaudio-devel`, `gcc`).
- Create a Python virtual environment in `.venv/`.
- Download the `piper-tts` voice models for text-to-speech.
- Register `gem.service` as a user-level systemd service, allowing Gem to auto-start on login.

To install:
```bash
bash install.sh
```

## 2. Hardware Calibration

### Microphone Setup
- Sit within 2-3 feet of your microphone.
- By default, Gem listens for **"hey_jarvis"**.
- The `VoiceAgent` uses `faster-whisper` and does not require you to pause after the wake word (e.g., *"Hey Jarvis, what's the weather?"*).

### Webcam Setup
- Gem uses OpenCV to capture periodic snapshots.
- Ensure your face is well-lit from the front so the Vision Agent can properly interpret expressions.

## 3. Custom Wake Words

Gem allows you to name your AI whatever you like by dynamically loading `.onnx` models from `openWakeWord`.

1. Go to the [openWakeWord HuggingFace Space](https://huggingface.co/spaces/davidscripka/openWakeWord).
2. Type in your desired wake word phrase phonetically (e.g., `ooga_booga`).
3. Download the generated `.onnx` file and place it in the `Back/models/` directory.
4. Update your `Back/.env` file with `WAKE_WORD=ooga_booga` (do not include the `.onnx` extension).
5. Restart the terminal.

---

## Unfinished Code & Potential Issues

> [!WARNING]
> **Hardcoded Camera Index**
> In `Back/agents/vision_agent.py`, OpenCV is hardcoded to `cv2.VideoCapture(0)`. Users with virtual cameras (like OBS) or multiple webcams attached may experience silent vision failures until they manually edit the Python script to match their active camera index.

> [!WARNING]
> **Piper TTS Dependency Failures**
> The `install.sh` script notes that `piper-tts` might fail to install automatically via pip on certain architectures. There is currently no robust fallback or error handling in the main application loop if the Piper service is missing or crashes.
