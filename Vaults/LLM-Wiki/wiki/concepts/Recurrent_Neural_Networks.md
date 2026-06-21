---
type: "Concept"
title: "Recurrent Neural Networks"
description: "A class of neural networks designed to process sequential data by maintaining internal memory through feedback connections."
tags: ["deep-learning", "neural-networks", "sequence-modeling"]
timestamp: "2026-06-21T06:59:19Z"
---
# Recurrent Neural Networks

## Summary

Recurrent Neural Networks (RNNs) are a class of neural networks designed to process sequential and time-series data by maintaining internal hidden states that act as memory of previous inputs. They are a core focus of Andrej Karpathy's PhD research and were a major subject of his influential blog post.

## Key Details

- RNNs process sequences by applying the same weights at each time step, allowing them to capture temporal dependencies in data.
- Karpathy's PhD at Stanford focused on recurrent neural networks and their applications in computer vision, natural language processing, and the intersection of both fields.
- His famous blog post "The Unreasonable Effectiveness of Recurrent Neural Networks" (2015) demonstrated the surprising power of RNNs for modeling sequences.
- The [[char-rnn]] open-source project by Karpathy implements character-level language models using LSTMs, GRUs, and RNNs built on [[Torch]].
- RNNs were widely used before the rise of [[Transformer Architecture]] for natural language processing tasks, but they remain important for many sequence modeling applications.

## Related Concepts

[[Deep Learning]], [[Natural Language Processing]], [[Computer Vision]], [[Transformer Architecture]], [[Large Language Models]]
