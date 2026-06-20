# Micrograd

[[Micrograd]] is a tiny scalar-valued autograd engine created by [[Andrej Karpathy]]. It implements backpropagation (reverse-mode automatic differentiation) over a dynamically built directed acyclic graph (DAG) and provides a small neural networks library on top of it with a PyTorch-like API.

## Technical Details

- **Type:** Scalar-valued autograd engine
- **Algorithm:** Backpropagation via reverse-mode autodiff
- **Data structure:** Dynamically built DAG (directed acyclic graph)
- **API style:** PyTorch-like

## Purpose

Micrograd serves as an educational tool for understanding how automatic differentiation and backpropagation work under the hood. It is used as part of Karpathy's [[Zero to Hero]] lecture series.

## Related Projects

- **[[makemore]]** — Series of generative model projects that build on autograd concepts
- **[[Zero to Hero]]** — Lecture series where Micrograd is featured

## Philosophy

Micrograd embodies Karpathy's educational philosophy of building complex systems from first principles, allowing students to understand every aspect of neural network training rather than using black-box libraries.

(source: [Andrej_Karpathy.md](assets/2026-06-20/Andrej_Karpathy.md))
