# Distributed Deep Learning Framework

A time-bound opportunistic distributed deep learning framework designed to accelerate PyTorch model training using idle personal devices (laptops and smartphones).

It uses a central controller (parameter server) running FastAPI and allows heterogeneous workers to join and leave dynamically, fetching tasks and executing local training asynchronously.

## Supported Architectures

| Model | Config | Description |
|-------|--------|-------------|
| `cnn` | `configs/cnn_mnist.yaml` | Convolutional Neural Network with batch norm & pooling |
| `mlp` | `configs/mlp_mnist.yaml` | Multi-Layer Perceptron with configurable hidden layers |
| `rnn` | `configs/rnn_mnist.yaml` | LSTM-based RNN (treats image rows as sequences) |
| `transformer` | `configs/transformer_mnist.yaml` | Vision Transformer with patch embedding & CLS token |
| `neural_net` | `configs/nn_mnist.yaml` | Basic vanilla feedforward network |

## Project Structure

```
distributed-dl/
├── configs/              # YAML training configs (model + dataset + hyperparams)
├── models/               # Model registry & architectures (CNN, MLP, RNN, Transformer, NN)
├── datasets/             # Dataset registry (MNIST)
├── common/               # Shared config & serialization utilities
├── controller/           # Parameter server (FastAPI)
├── worker/               # Worker node (fetches tasks, trains locally, sends gradients)
├── normal_train.py       # Single-machine baseline trainer
└── requirements.txt
```

## Setup

### Pre-requisites
- Python 3.10+
- `pip` package manager

### Installation

```bash
pip install -r requirements.txt
```

*(For Termux on Android, run `pkg update`, `pkg install python`, and `pip install torch torchvision fastapi requests pyyaml`)*

## Running the System

### 1. Start the Controller

```bash
# Default (CNN on MNIST):
uvicorn controller.controller:app --host 0.0.0.0 --port 8000

# Use a different architecture:
CONFIG_PATH=configs/transformer_mnist.yaml uvicorn controller.controller:app --host 0.0.0.0 --port 8000
```

### 2. Start a Worker

```bash
python worker/worker.py --controller-ip <CONTROLLER_IP>
```

Workers automatically detect the model architecture from the controller's task payload — no config needed on the worker side.

### 3. Single-Machine Baseline

Compare distributed training against a local baseline:

```bash
python normal_train.py --config configs/cnn_mnist.yaml
python normal_train.py --config configs/rnn_mnist.yaml
python normal_train.py --list-models  # Show all available architectures
```

## Adding a New Architecture

1. Create `models/your_model.py`
2. Use the `@register("your_model")` decorator
3. Create `configs/your_model_mnist.yaml`
4. Done — controller and workers will pick it up automatically

## Features
- **Model-Agnostic Framework**: Supports any PyTorch architecture via the model registry
- **YAML Config System**: One config file defines model, dataset, and training hyperparameters
- **Time-Bounded Computation**: Controller estimates local steps `k` based on worker capabilities
- **Asynchronous SGD**: Gradients applied as they arrive with staleness dropping
- **Dynamic Workers**: Workers can join or fail at any time without blocking training
