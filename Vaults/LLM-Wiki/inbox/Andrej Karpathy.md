# Andrej Karpathy

_I like to train deep neural nets on large datasets_

I create educational videos on AI on my YouTube channel. The videos come in two parallel tracks: a technical track and a general audience track.

1. Technical track: Follow the Zero to Hero playlist. General audience track:

2. Deep Dive into LLMs like ChatGPT is on under-the hood fundamentals of LLMs.

3. How I use LLMs is a more practical guide to examples of use in my own life.

4. Intro to Large Language Models is a third, parallel, video from a longer time ago.

For all the latest, I spend most of my time on X/Twitter or GitHub.

I came back to OpenAI where I built a new team working on midtraining and synthetic data generation.

I was the Director of AI at Tesla, where I led the computer vision team of Tesla Autopilot and (very briefly) Tesla Optimus. My team handled all in-house data labeling, neural network training and deployment on Tesla's custom inference chip. Today, the Autopilot increases the safety and convenience of driving, but the team's goal is to make Full Self-Driving a reality at scale. See Aug 2021 Tesla AI Day for more.

2015 - I was a research scientist and a founding member at OpenAI.

2017

2011 - My PhD was focused on convolutional/recurrent neural networks and

2015 their applications in computer vision, natural language processing and

their intersection. My adviser was Fei-Fei Li at the Stanford Vision Lab

and I also had the pleasure to work with Daphne Koller, Andrew Ng,

Sebastian Thrun and Vladlen Koltun along the way during the first year

rotation program.

I designed and was the primary instructor for the first deep learning class

Stanford - CS 231n: Convolutional Neural Networks for Visual

Recognition. The class became one of the largest at Stanford and has

grown from 150 enrolled in 2015 to 330 students in 2016, and 750

students in 2017.

Along the way I squeezed in 3 internships at (baby) Google Brain in 2011

working on learning-scale unsupervised learning from videos, then again

in Google Research in 2013 working on large-scale supervised learning

on YouTube videos, and finally at DeepMind in 2015 working on the deep

reinforcement learning team with Koray Kavukcuoglu and Vlad Mnih.

2009 - MSc at the University of British Columbia where I worked with Michiel van

2011 de Panne on learning controllers for physically-simulated figures (i.e.,

machine-learning for agile robotics but in a physical simulation).

2005 - BSc at the University of Toronto with a double major in computer science

2009 and physics and a minor in math. This is where I first got into deep

learning, attending Geoff Hinton's class and reading groups.

## bio

Andrej Karpathy is an AI researcher and educator. He was a founding member of OpenAI and

later the Director of AI at Tesla, where he led the computer vision team of the Autopilot. During his

PhD at Stanford he was the architect and lead instructor of the first deep learning course at

Stanford (CS231n), which has become one of its most popular classes.

## featured talks

LLMs are a different kind of intelligence.

Dwarlesh podcast 2025

GPU Mode 2024

UC Berkeley AI Hackathon 2024

YC AI Startup School 2025

No Priors podcast 2024

State of GPT @ Microsoft Build 2023 (slides)

Andrej
Karpathy
#333
Lex
Fridman

Lex Fridman podcast 2022

Robot Brains podcast with Pieter Abbeel 2021

In-house supercomputer

Tesla AI Day 2021

AI for Full Self-Driving @ CVPR 2021

AI for Full Self-Driving @ ScaledML 2020

Tesla Autonomy Day 2019

Multi-Task Learning in the Wilderness @ ICML 2019

PyTorch at Tesla @ PyTorch DevCon 2019

Building the Software 2.0 stack @ Spark-AI 2018

2017 "Heroes of Deep Learning" with Andrew Ng

2017 RE·WORK Summit with Nathan Benaich

2016 Bay Area Deep Learning School: CNNs

Deep Learning Workshop @ CVPR 2016

RE·WORK Deep Learning Summit 2016

NVIDIA GTC Keynote 2015 with Jensen Huang

## teaching

I have a YouTube channel, where I post lectures on LLMs and AI more generally.

**1hr Talk] Intro to Large Language**
**Models**

1M views • 4 weeks ago

**Building makemore Part 3:**
**Activations & Gradients, BatchNorm**

184K views • 1 year ago

**Let's build GPT: from scratch, in**
**code, spelled out.**

3.5M views • 11 months ago

**Building makemore Part 2: MLP**
210K views • 1 year ago

**Building makemore Part 5: Building**
**a WaveNet**

126K views • 1 year ago

**Building makemore Part 4:**
**Becoming a Backprop Ninja**

127K views • 1 year ago

**The spelled-out intro to neural**
**networks and backpropagation:...**

1.2M views • 1 year ago

**The spelled-out intro for the first deep learning class Stanford - CS**
**231n: Convolutional Neural Networks for Visual Recognition** . The class became one of the
largest at Stanford and has grown from 150 enrolled in 2015 to 330 students in 2016, and 750
students in 2017.

**my 2016 lecture videos** **course notes** **course syllabus** **r/cs231n**

# featured writing

I have three blogs . This GitHub blog is my oldest one. I then briefly and sadly switched to my
second blog on Medium. I now have a Bear blog. Here is the (a bit outdated) collection of some
of my most popular posts:

Mar 2021 A from-scratch tour of Bitcoin in Python
Mar 2021 Short Story on AI: Forward Pass
Jun 2020 Biohacking Lite

Apr 2019 A Recipe for Training Neural Networks

Nov 2017 Software 2.0

Sep 2016 A Survival Guide to a PhD

Nov 2015 Short Story on AI: A Cognitive Discontinuity

May 2015 The Unreasonable Effectiveness of Recurrent Neural Networks

Sep 2014 What I learned from competing against a ConvNet on ImageNet

Oct 2012 The state of Computer Vision and AI: we are really, really far away.

pet projects

This list is now very outdated :) see my up to date projects on my GitHub.

micrograd is a tiny scalar-valued autograd engine (with a bite! :)). It implements

backpropagation (reverse-mode autodiff) over a dynamically built DAG and a small

neural networks library on top of it with a PyTorch-like API.

char-rnn was a Torch character-level language model built out of

LSTMs/GRUs/RNNs. Related to this also see the Unreasonable Effectiveness of

Recurrent Neural Networks blog post, or the minimal RNN gist.

arxiv-sanity tames the overwhelming flood of papers on Arxiv. It allows researchers

to discover relevant papers, search/sort by similarity, see recent/popular papers,

and get recommendations. Deployed live at arxiv-sanity.com. My obsession with

meta research involved many more projects over the years, e.g. see pretty NIPS

2020 papers, research lei, scholarotopus, and biomed-sanity. Update: my most revert arxiv-

sanity-lite from-scratch rewrite is much better.

neuraltalk2 was an early image captioning project in (lua)Torch. Also see our later

extension with Justin Johnson to dense captioning.

I am sometimes jokingly referred to as the reference human for ImageNet because I

competed against an early ConvNet on categorizing images into 1,000 classes. This

required a bunch of custom tooling and a lot of learning about dog breeds. See the

blog post "What I learned from competing against a ConvNet on ImageNet". Also a

Wired article.

ConvNetJS is a deep learning library written from scratch entirely in Javascript. This enables nice

web-based demos that train convolutional neural networks (or ordinary ones) entirely in the

browser. Many web demos included. I did an interview with Data Science Weekly about the

library and some of its back story here. Also see my later followups such as tSNEJS,

REINFORCEjs, or recurrentjs, GANs in JS.

How productive were you today? How much code have you written? Where did your

time go? For a while I was really into tracking my productivity, and since I didn't like

that RescueTime uploads your (very private) computer usage statistics to a cloud I

wrote my own, privacy-first, tracker - ulogme! That was fun.

misc: I built a lot of other random stuff over time. Rubik's cube color extractor,

predator prey neuroevolutionary multiagent simulations, more of those, sketcher

bots, games for computer game competitions #1, #2, #3, random computer graphics

things, Tetris AI, multiplayer coop tetris, etc.

publications

World of Bits: An Open-Domain Platform for Web-Based Agents ICML 2017

Tianlin (Tim) Shi, Andrej Karpathy, Linxi (Jim) Fan, Jonathan Hernandez, Percy Liang

PixelCNN++: A PixelCNN Implementation with Discretized Logistic Mixture Likelihood and Other

Modifications ICLR 2017

Tim Salimans, Andrej Karpathy, Xi Chen, Diederik P. Kingma, and Yaroslav Bulatov

Connecting Images and Natural Language (PhD thesis) 2016

Andrej Karpathy

DenseCap: Fully Convolutional Localization Networks for Dense Captioning CVPR 2016 (Oral)

Justin Johnson*, Andrej Karpathy*, Li Fei-Fei

Visualizing and Understanding Recurrent Networks ICLR 2016 Workshop

Andrej Karpathy*, Justin Johnson*, Li Fei-Fei

Deep Visual-Semantic Alignments for Generating Image Descriptions CVPR 2015 (Oral)

Andrej Karpathy, Li Fei-Fei

ImageNet Large Scale Visual Recognition Challenge IJCV 2015

Olga Russakovsky, Jia Deng, Hao Su, Jonathan Krause, Sanjeev Satheesh, Sean Ma, Zhiheng Huang,

Andrej Karpathy, Aditya Khosla, Michael Bernstein, Alexander C. Berg, Li Fei-Fei

Deep Fragment Embeddings for Bidirectional Image-Sentence Mapping NIPS 2014

Andrej Karpathy, Armand Joulin, Li Fei-Fei

Large-Scale Video Classification with Convolutional Neural Networks CVPR 2014 (Oral)

Andrej Karpathy, George Toderici, Sanketh Shetty, Thomas Leung, Rahul Sukthankar, Li Fei-Fei

Grounded Compositional Semantics for Finding and Describing Images with Sentences TACL 2013

Richard Socher, Andrej Karpathy, Quoc V. Le, Christopher D. Manning, Andrew Y. Ng

Object Discovery in 3D scenes via Shape Analysis ICRA 2013

Andrej Karpathy, Stephen Miller, Li Fei-Fei

Emergence of Object-Selective Features in Unsupervised Feature Learning NIPS 2012

Adam Coates, Andrej Karpathy, Andrew Ng

Curriculum Learning for Motor Skills Al 2012

Andrej Karpathy, Michiel van de Panne

Locomotion Skills for Simulated QuadrupedS SIGGRAPH 2011

Stelian Coros, Andrej Karpathy, Benjamin Jones, Lionel Reveret, Michiel van de Panne

Also on Google Scholar

misc unsorted

Neural Networks:Zero To Hero lecture series

My first blog my second blog and my current blog

I like sci-fi.I enumerated and sorted sci-fi books I've read here

Justin Johnson and I held a reading group on Clubhouse.See YouTube or as podcast

Loss function Tumblr :D! My collection of funny loss functions.

Some advice for undergrads and advice for those considering or pursuing a PhD

New York Times article covering my PhD image captioning work.

t-SNE visualization of CNN codes for ImageNet, pretty!

A long time ago I was really into Rubik's Cubes.I learned to solve them in about 17 seconds

and then, frustrated by lack of learning resources, created YouTube videos explaining the

Speedcubing methods.These went on to become relatively popular.There's also my long dead

cubing page.Oh, and a video of me at a Rubik's cube competition :)

0 frameworks were used to make this simple responsive website because I am becoming

seriously allergic to 500-pound websites. This one is pure HTML and CSS in two static files and

that's it.

