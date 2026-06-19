# Deep Learning

Deep learning is a subset of machine learning that uses multi-layered neural networks to learn representations of data. It has become the dominant approach in artificial intelligence, particularly for tasks like computer vision, natural language processing, and speech recognition.

## Key Architectures

- **Convolutional Neural Networks (CNNs)** — widely used for image recognition and computer vision tasks. Popularized by [[Fei-Fei Li]]'s work on ImageNet and the Stanford CS231n course taught by [[Andrej Karpathy]].
- **Recurrent Neural Networks (RNNs)** — designed for sequential data, including variants like LSTMs and GRUs. Used in [[char-rnn]] and language modeling.
- **PixelCNN / PixelRNN** — autoregressive models for image generation, extended in PixelCNN++ with discretized logistic mixture likelihood.
- **Transformer models** — foundation for modern [[LLMs]], though not explicitly detailed in the Karpathy source material.

## Applications

- Computer vision: image classification, object detection, image captioning (e.g., [[NeuralTalk2]], [[ConvNetJS]])
- Natural language processing: language modeling, text generation
- Reinforcement learning: [[DeepMind]] research on deep reinforcement learning

## Backpropagation

Backpropagation (reverse-mode autodiff) is the core algorithm for training neural networks. [[Andrej Karpathy]] created educational resources explaining it in detail, including "The spelled-out intro to neural networks and backpropagation" and [[micrograd]], a tiny scalar-valued autograd engine.

## Sources

([source](inbox/Andrej_Karpathy.md))
