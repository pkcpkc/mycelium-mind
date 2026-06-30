type: "Concept"
title: "Recurrent Neural Networks (RNNs)"
tags:
  - AI
  - Machine Learning
  - Deep Learning
  - Natural Language Processing (NLP)
  - Sequence Modeling

## Description
Recurrent Neural Networks (RNNs) are a class of neural networks designed to process sequential data. Unlike standard feed-forward networks, RNNs possess "memory" by utilizing internal loops that allow information to persist across different steps of a sequence. This architecture makes them particularly effective for tasks involving time-series data, speech recognition, and Natural Language Processing (NLP).

## Key Characteristics
- **Sequential Processing**: Processes inputs one at a time, where the output of a previous step serves as an input for the current step.
- **Hidden State**: Maintains a hidden state vector that acts as a memory of previous inputs in the sequence.
- **Weight Sharing**: Uses the same weights across every step of the sequence, allowing the model to generalize patterns regardless of their position in time.

## Related Concepts
- [[Deep Neural Networks]]
- [[Large Language Models (LLMs)]]
- [[Convolutional Neural Networks (CNNs)]]
- [[Computer Vision]]
- [[Natural Language Processing (NLP)]]
- [[Reinforcement Learning]]
- [[Autodiff]]
- [[Software 2.0]]
- [[Synthetic Data Generation]]

## Research & Educational Context
- **Academic Foundations**: RNNs were a primary focus of doctoral research at the Stanford Vision Lab (e.g., research conducted by [[Andrej Karpathy]]).
- **Applications**: Historically significant in early NLP and speech synthesis before the widespread adoption of Transformers for [[Large Language Models (LLMs)]].
- **Educational Resources**: Often taught as a foundational architecture in deep learning curricula (e.g., Stanford CS 231n) to explain the transition from static to sequential data modeling.