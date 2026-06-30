type: "Concept"
title: "Autodiff"
tags:
  - AI
  - Machine Learning
  - Deep Learning
  - Mathematics
  - Software 2.0

## Overview
Automatic Differentiation (Autodiff) is a set of techniques to numerically evaluate the derivative of a function specified by a computer program. It is the foundational technology behind modern [[Deep Learning]] frameworks, enabling the efficient calculation of gradients required for backpropagation.

## Key Characteristics
- **Computational Graphs**: Autodiff typically represents mathematical expressions as directed acyclic graphs (DAGs), where nodes are operations and edges are tensors.
- **Forward vs. Reverse Mode**: 
    - **Forward Mode**: Computes the derivative of the output with respect to a single input.
    - **Reverse Mode**: Computes the derivative of a scalar output with respect to all inputs; this is the standard method for training [[Large Language Models (LLMs)]] and [[Convolutional Neural Networks (CNNs)]].
- **Software 2.0**: Autodiff is a core component of the "Software 2.0" paradigm, where models are defined by data and optimization rather than manual logic.

## Notable Implementations & Projects
- **micrograd**: A minimalist autograd engine developed by [[Andrej Karpathy]] to demonstrate the fundamental principles of backpropagation in a highly readable way.
- **PyTorch**: A major industrial framework utilizing dynamic computational graphs for Autodiff.

## Related Concepts
- [[Deep Neural Networks]]
- [[Large Language Models (LLMs)]]
- [[Software 2.0]]
- [[Synthetic Data Generation]]