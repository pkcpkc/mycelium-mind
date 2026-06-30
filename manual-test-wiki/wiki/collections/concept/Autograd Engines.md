type: "Concept"
title: "Autograd Engines"
tags:
  - AI
  - Machine Learning
  - Deep Learning
  - Software 2.0
timestamp: <timestamp>

## Definition
An Autograd Engine is a software framework or library designed to automatically compute the gradients of a mathematical function with respect to its input parameters. This process, known as automatic differentiation, is the fundamental mechanism that enables the training of [[Deep Neural Networks]] and [[LLMs]].

## Core Mechanics
- **Computational Graphs**: Autograd engines represent mathematical operations as a directed acyclic graph (DAG) where nodes are operations and edges are tensors.
- **Backpropagation**: The engine traverses this graph in reverse order to apply the chain rule, calculating how each weight contributes to the final loss.
- **Dynamic vs. Static Graphs**: 
    - *Static*: The graph is defined and compiled before execution (e.g., older versions of TensorFlow).
    - *Dynamic*: The graph is built on-the-fly during the forward pass (e.g., PyTorch).

## Key Implementations & Context
- **micrograd**: A prominent educational project by [[Andrej Karpathy]] that implements a backpropagation engine from scratch. It serves as a "minimalist" autograd engine to demonstrate the fundamental principles of [[Deep Learning]].
- **Software 2.0**: Autograd engines are the primary enablers of "Software 2.0," where models are defined by their weights and gradients rather than explicit human-written logic.

## Related Concepts
- [[Deep Neural Networks]]
- [[LLMs]]
- [[Software 2.0]]
- [[Computer Vision]]
- [[Natural Language Processing]]