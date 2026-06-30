type: "Concept"
title: "Software 2.0"
tags:
  - AI
  - Machine Learning
  - Deep Learning
  - Neural Networks
  - Andrej Karpathy
timestamp: <timestamp>

## Definition
Software 2.0 refers to the paradigm shift where software is expressed as optimized weights of a neural network rather than explicit human-written code (Software 1.0). In this framework, the "programming" happens through data and objective functions, while the underlying logic is learned by an [[Autograd Engine]] and optimized via backpropagation.

## Core Principles
- **Optimization over Instruction**: Instead of writing specific `if-then` statements, developers define a loss function and provide data.
- **Neural Representation**: Programs are represented as high-dimensional weights in [[Deep Neural Networks]].
- **Data-Driven Logic**: The "code" is synthesized by the model during the training process, allowing it to handle complex patterns (like vision or language) that are difficult to hard-code.
- **Inference as Execution**: Running the software involves a forward pass through a model rather than executing a sequence of imperative instructions.

## Key Components & Related Concepts
- **Training Pipeline**: The process of converting data into Software 2.0 logic, involving [[Synthetic Data Generation]] and [[Midtraining]].
- **Hardware Acceleration**: The reliance on GPUs and custom inference chips to execute the massive matrix multiplications inherent in Software 2.0.
- **Foundational Technologies**: Built upon [[Computer Vision]], [[Natural Language Processing]], and [[Reinforcement Learning]].

## Key Figures & Influences
- **Andrej Karpathy**: A primary advocate for the Software 2.0 concept, emphasizing the shift from "writing code" to "training models."
- **OpenAI & Tesla**: Organizations leading the industrial application of Software 2.0 in autonomous systems and large-scale [[LLMs]].

## Contextual Synthesis
Software 2.0 is the foundational philosophy behind modern AI development. By moving away from the limitations of human-readable logic for complex tasks, it enables the creation of systems capable of general-purpose reasoning and perception. This shift is best exemplified by the move from traditional computer vision algorithms to end-to-end deep learning models.