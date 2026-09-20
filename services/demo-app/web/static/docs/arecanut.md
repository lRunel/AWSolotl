# 🌴 Arecanut Disease Detection — Mobile & UAV

An AI-powered **React Native (Expo)** mobile application and **UAV/drone remote-sensing pipeline** for real-time detection and management of arecanut (betel nut) palm diseases. The system combines on-device CNN inference with drone-based heatmap analysis to help farmers identify diseases early and take corrective action.

---

## ✨ Features

### 📱 Mobile Application
| Feature | Description |
|---|---|
| **On-Device AI Scanning** | Capture or upload an image of an arecanut tree and get an instant disease prediction powered by a quantized TFLite CNN model running entirely on-device. |
| **9-Class Classification** | Detects **5 disease/defect classes** (Mahali Koleroga, Stem Bleeding, Bud Borer, Stem Cracking, Yellow Leaf Disease) and **4 healthy classes** (Healthy Leaf, Healthy Nut, Healthy Trunk, Healthy Foot). |
| **Disease Information** | Detailed disease cards showing cause, description, recommended treatment/fertilizer, and product suggestions. |
| **Fertilizer Reminders** | Set persistent reminders for treatment schedules directly from diagnosis results. |
| **Scan History** | Automatically logs every scan with date and disease name for future reference. |
| **Chatbot Assistant** | An offline, keyword-driven chatbot that answers questions about disease symptoms, treatment, and general arecanut care. |
| **Farmer Profile** | Save and manage farmer details (name, phone, address) locally on-device. |
| **OTP Login** | Simple phone-number based OTP authentication flow (demo mode). |

### 🛩️ Drone / UAV Analysis
| Feature | Description |
|---|---|
| **GeoTIFF Scanning** | Processes high-resolution drone orthomosaic images (`.tif`) tile-by-tile using the same CNN model. |
| **Disease Heatmap** | Generates a color-coded density heatmap overlay showing disease probability across the plantation. |
| **Digital Zoom** | Uses configurable tile sizes (default 100px) upscaled to 224px to simulate close-up views from aerial imagery. |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Expo](https://expo.dev) (SDK 54) with [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing) |
| **Language** | TypeScript / React Native 0.81 |
| **AI Inference** | [react-native-fast-tflite](https://github.com/nicklausw/react-native-fast-tflite) — runs a quantized INT8 TFLite model on-device |
| **Image Processing** | [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/) — RGBA → BGR tensor conversion matching OpenCV preprocessing |
| **Camera** | [expo-camera](https://docs.expo.dev/versions/latest/sdk/camera/) + [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) |
| **Storage** | [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) — local persistence for history, reminders, and profiles |
| **Drone Pipeline** | Python · TensorFlow/Keras · Rasterio · Matplotlib · SciPy |

---

## 📁 Project Structure

```
mini_project_frontend/
├── app/                        # Expo Router screens (file-based routing)
│   ├── _layout.tsx             # Root stack navigator
│   ├── index.tsx               # Login screen (OTP flow)
│   ├── home.tsx                # Home dashboard with navigation menu
│   ├── scan.tsx                # Camera + AI inference screen
│   ├── result.tsx              # Disease diagnosis result card
│   ├── description.tsx         # Browse all disease types
│   ├── reminder.tsx            # Fertilizer reminder management
│   ├── history.tsx             # Past scan log
│   ├── chatbot.tsx             # Offline chatbot assistant
│   └── profile.tsx             # Farmer profile editor
│
├── assets/
│   ├── images/                 # App icons, splash screen
│   └── model/
│       └── model_cnn_int8.tflite   # Quantized CNN model (INT8)
│
├── components/                 # Reusable UI components
│   ├── Button.tsx
│   ├── parallax-scroll-view.tsx
│   ├── themed-text.tsx
│   └── ...
│
├── data/                       # Static data & knowledge base
│   ├── diseaseData.ts          # Disease info (cause, treatment, reminders)
│   ├── chatbotData.ts          # Chatbot topics, keywords & responses
│   └── historyStorage.ts       # Storage utilities
│
├── drone/                      # UAV remote sensing pipeline
│   └── dronepart.ipynb         # Jupyter notebook: tile scanning + heatmap
│
├── model side/                 # Model training artifacts
│   ├── model.ipynb             # CNN training notebook
│   ├── cnn.h5                  # Full Keras model (H5)
│   └── model_cnn_int8.tflite   # Quantized TFLite export
│
├── types.ts                    # Shared TypeScript interfaces
├── app.json                    # Expo configuration
├── package.json                # Dependencies & scripts
└── tsconfig.json               # TypeScript configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **Expo CLI** — installed globally or via `npx`
- **Android device / emulator** (iOS is supported but untested)
- For the drone pipeline: **Python 3.9+** with `tensorflow`, `rasterio`, `matplotlib`, `scipy`, `scikit-image`

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AnanyaDevadiga2006/arecanut-mobile-and-uav-.git
   cd arecanut-mobile-and-uav-
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npx expo start
   ```

4. **Run on a device**
   - Scan the QR code with **Expo Go** (limited features), or
   - Press `a` to launch on a connected **Android device/emulator**, or
   - Build a [development build](https://docs.expo.dev/develop/development-builds/introduction/) for full native module support:
     ```bash
     npx expo run:android
     ```

> [!IMPORTANT]
> A **development build** (`expo run:android`) is required for the TFLite model and camera to work. Expo Go does not support native modules like `react-native-fast-tflite`.

---

## 🧠 Model Details

| Property | Value |
|---|---|
| **Architecture** | CNN (Convolutional Neural Network) |
| **Input Size** | 224 × 224 × 3 (BGR, normalized to [0, 1]) |
| **Quantization** | INT8 (TFLite) |
| **Classes (9)** | `Healthy_Leaf`, `Healthy_Nut`, `Healthy_Trunk`, `healthy_foot`, `Mahali_Koleroga`, `Stem_bleeding`, `bud borer`, `stem cracking`, `yellow leaf disease` |
| **Training** | See `model side/model.ipynb` |
| **Mobile Model** | `assets/model/model_cnn_int8.tflite` (~3 MB) |

### Image Preprocessing Pipeline (Mobile)
1. Image decoded via **Skia** and resized to 224×224
2. Raw **RGBA** pixels read from a Skia surface
3. Converted to **BGR float32** (each channel / 255.0) to match the OpenCV-based Python training pipeline
4. Fed as a flattened `Float32Array` to `model.run()`

---

## 🛩️ Drone Pipeline Usage

The drone analysis notebook (`drone/dronepart.ipynb`) processes GeoTIFF orthomosaic imagery:

1. **Configure paths** — Set `MODEL_PATH` and `TIFF_PATH` in the notebook
2. **Run tile scanning** — Each tile (100×100 px) is upscaled to 224×224 and passed through the CNN
3. **Generate heatmap** — A Gaussian-smoothed heatmap is overlaid on the drone image showing disease density

```python
# Key parameters
WINDOW_SIZE_DRONE = 100   # Tile size from GeoTIFF (try 64 for higher zoom)
WINDOW_SIZE_MODEL = 224   # Model input size
DISEASE_CLASS_INDEX = 8   # Yellow Leaf Disease class index
```

---

## 📸 App Screens

| Screen | Purpose |
|---|---|
| **Login** | Phone number OTP authentication (demo: OTP = `123456`) |
| **Home** | Dashboard with navigation to all features + scan button |
| **Scan** | Live camera view or gallery upload → AI prediction |
| **Result** | Disease name, cause, description, treatment & reminder |
| **Description** | Grid view of all 9 classification categories |
| **Reminder** | List of saved fertilizer/treatment reminders |
| **History** | Chronological log of all past scans |
| **Chatbot** | Ask about symptoms, treatment, or general arecanut care |
| **Profile** | Edit and save farmer details locally |

---

## 🤖 Chatbot

The chatbot uses a **two-level keyword matching** system (no API/internet required):

1. **Topic Detection** — Matches user input against topic keywords (e.g., "koleroga", "yellow leaf", "bud rot")
2. **Intent Detection** — Detects secondary intent keywords (symptoms, treatment, what_is, dose) to select the most relevant answer

Chatbot data is defined in `data/chatbotData.ts` and can be easily extended with new topics.

---

## 🗂️ Disease Classes Supported

| Class | Type | Key Treatment |
|---|---|---|
| Mahali Koleroga | Fungal (Phytophthora) | 1% Bordeaux mixture spray |
| Stem Bleeding | Fungal (Thielaviopsis) | Scrape lesion + fungicide paste |
| Bud Borer | Insect pest | Systemic insecticide (Imidacloprid) |
| Stem Cracking | Nutrient deficiency (Boron) | Borax supplement + consistent irrigation |
| Yellow Leaf Disease | Phytoplasma + nutrient deficiency | NPK + micronutrients, improve drainage |
| Healthy Leaf | — | No action needed |
| Healthy Nut | — | No action needed |
| Healthy Trunk | — | No action needed |
| Healthy Foot | — | No action needed |

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Expo development server |
| `npm run android` | Build and run on Android |
| `npm run ios` | Build and run on iOS |
| `npm run web` | Start web version |
| `npm run lint` | Run ESLint |

---

## 📄 License

This project is part of an academic mini-project. Please contact the authors for usage permissions.

---

## 👥 Authors

Developed as a mini-project for arecanut disease detection using mobile and UAV-based remote sensing technologies.
