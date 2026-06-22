---
type: "Concept"
title: "Backpropagation"
description: "A foundational algorithm for training neural networks by efficiently computing gradients of the loss function with respect to weights using the chain rule."
tags:
  - deep-learning
  - neural-networks
  - optimization
  - machine-learning
timestamp: "2026-06-22T18:21:28Z"
---
# Backpropagation

## Summary

Backpropagation (backward propagation of errors) is the core algorithm used to train [[Deep Learning]] models and other differentiable neural network architectures. It efficiently computes the gradient of the loss function with respect to each weight by applying the chain rule of calculus, propagating error signals backward through the computational graph.

## Key Details

- **Chain Rule Application:** Decomposes the computation of gradients layer-by-layer, enabling efficient training of deep architectures without re-computing partial derivatives from scratch.
- **Computational Graphs:** Operates on directed acyclic graphs representing mathematical operations, allowing automatic differentiation in modern frameworks like [[PyTorch]].
- **Educational Foundations:** Central to the curriculum of [[CS 231n]] at [[Stanford University]], where its step-by-step implementation is emphasized to demystify neural network training.
- **From-Scratch Implementation:** Projects like [[micrograd]] demonstrate the algorithm by building a minimal autograd engine and training engine from the ground up, highlighting its practical mechanics.
- **Optimization Role:** Provides the gradient signal required for optimization algorithms (e.g., SGD, Adam) to update model parameters and minimize loss across [[Large Language Models]], [[Computer Vision]], and [[Reinforcement Learning]] systems.

## Related Concepts

[[Deep Learning]], [[Neural Networks]], [[PyTorch]], [[CS 231n]], [[micrograd]], [[Large Language Models]], [[Convolutional Neural Networks]], [[Optimization Algorithms]], [[Stanford University]]