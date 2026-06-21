---
type: "Overview"
title: "Social Graph"
tags: ["graph", "persons"]
timestamp: "2026-06-21T00:00:00Z"
---

# Social Graph

```mermaid
flowchart LR
    AK["Andrej Karpathy"] --> FFL["Fei-Fei Li"]
    AK --> DK["Daphne Koller"]
    AK --> AN["Andrew Ng"]
    AK --> ST["Sebastian Thrun"]
    AK --> VK["Vladlen Koltun"]
    AK --> MvP["Michiel van de Panne"]
    AK --> GH["Geoffrey Hinton"]
    AK --> KK["Koray Kavukcuoglu"]
    AK --> VM["Vlad Mnih"]
    AK --> JH["Jensen Huang"]
    AK --> PA["Pieter Abbeel"]
    AK --> JJ["Justin Johnson"]
    AK --> TS["Tim Salimans"]
    AK --> XC["Xi Chen"]
    AK --> DKP["Diederik P. Kingma"]
    AK --> YB["Yaroslav Bulatov"]
    AK --> RS["Richard Socher"]
    AK --> QVL["Quoc V. Le"]
    AK --> CDM["Christopher D. Manning"]
    AK --> AC["Adam Coates"]
    AK --> SM["Stephen Miller"]
    AK --> SC["Stelian Coros"]
    AK --> BJ["Benjamin Jones"]
    AK --> LR["Lionel Reveret"]
    AK --> TL["Tianlin Shi"]
    AK --> PL["Percy Liang"]
    AK --> OR["Olga Russakovsky"]
    AK --> JD["Jia Deng"]
    AK --> HS["Hao Su"]
    AK --> JK["Jonathan Krause"]
    AK --> ACh["Aditya Khosla"]
    AK --> ACB["Alexander C. Berg"]
    AK --> GT["George Toderici"]
    AK --> SS["Sanketh Shetty"]
    AK --> ThL["Thomas Leung"]
    AK --> RaS["Rahul Sukthankar"]
    AK --> AJ["Armand Joulin"]
    AK --> LF["Lex Fridman"]
    AK --> DW["Dwarlesh"]
    AK --> NB["Nathan Benaich"]

    FFL -- "PhD advisor" --> AK
    AN -- "Rotation advisor" --> AK
    DK -- "Rotation advisor" --> AK
    ST -- "Rotation advisor" --> AK
    VK -- "Rotation advisor" --> AK
    MvP -- "MSc supervisor" --> AK
    GH -- "Influenced (classes)" --> AK
    FFL -- "Co-author" --> JJ
    FFL -- "Co-author" --> OR
    FFL -- "Co-author" --> JD
    FFL -- "Co-author" --> HS
    FFL -- "Co-author" --> JK
    FFL -- "Co-author" --> ACh
    FFL -- "Co-author" --> ACB
    FFL -- "Co-author" --> AJ
    FFL -- "Co-author" --> ThL
    FFL -- "Co-author" --> RaS
    FFL -- "Co-author" --> SS
    FFL -- "Co-author" --> GT
    FFL -- "Co-author" --> SM
    AN -- "Co-author" --> AC
    AN -- "Co-author" --> RS
    AN -- "Co-author" --> QVL
    AN -- "Co-author" --> CDM
    JJ -- "DenseCap co-author" --> AK
    JJ -- "DenseCap co-author" --> FFL
    VM -- "DeepMind colleague" --> KK
    VM -- "DeepMind colleague" --> GH
    VM -- "DeepMind colleague" --> AK
    KK -- "DeepMind colleague" --> VM
    KK -- "DeepMind colleague" --> GH
    KK -- "DeepMind colleague" --> AK
    TS -- "PixelCNN++ co-author" --> AK
    TS -- "PixelCNN++ co-author" --> DKP
    TS -- "PixelCNN++ co-author" --> XC
    TS -- "PixelCNN++ co-author" --> YB
    DKP -- "Adam optimizer co-creator" --> AN
    DKP -- "PixelCNN++ co-author" --> AK
    DKP -- "PixelCNN++ co-author" --> XC
    DKP -- "PixelCNN++ co-author" --> YB
    XC -- "PixelCNN++ co-author" --> AK
    XC -- "PixelCNN++ co-author" --> DKP
    XC -- "PixelCNN++ co-author" --> TS
    XC -- "PixelCNN++ co-author" --> YB
    YB -- "PixelCNN++ co-author" --> AK
    YB -- "PixelCNN++ co-author" --> DKP
    YB -- "PixelCNN++ co-author" --> TS
    YB -- "PixelCNN++ co-author" --> XC
    RS -- "Grounded Compositional Semantics co-author" --> CDM
    RS -- "Grounded Compositional Semantics co-author" --> QVL
    RS -- "Grounded Compositional Semantics co-author" --> AN
    RS -- "Grounded Compositional Semantics co-author" --> AK
    QVL -- "Grounded Compositional Semantics co-author" --> CDM
    QVL -- "Grounded Compositional Semantics co-author" --> AN
    QVL -- "Grounded Compositional Semantics co-author" --> RS
    QVL -- "Grounded Compositional Semantics co-author" --> AK
    CDM -- "Grounded Compositional Semantics co-author" --> AN
    CDM -- "Grounded Compositional Semantics co-author" --> RS
    CDM -- "Grounded Compositional Semantics co-author" --> QVL
    CDM -- "Grounded Compositional Semantics co-author" --> AK
    AC -- "NIPS 2012 co-author" --> AN
    AC -- "NIPS 2012 co-author" --> AK
    ST -- "Udacity co-founder" --> AN
    ST -- "Rotation advisor" --> DK
    ST -- "Rotation advisor" --> VK
    ST -- "Rotation advisor" --> FFL
    ST -- "Rotation advisor" --> AK
    DK -- "Rotation advisor" --> AN
    DK -- "Rotation advisor" --> ST
    DK -- "Rotation advisor" --> VK
    DK -- "Rotation advisor" --> FFL
    DK -- "Rotation advisor" --> AK
    VK -- "Rotation advisor" --> AN
    VK -- "Rotation advisor" --> DK
    VK -- "Rotation advisor" --> ST
    VK -- "Rotation advisor" --> FFL
    VK -- "Rotation advisor" --> AK
    MvP -- "SIGGRAPH 2011 co-author" --> SC
    MvP -- "SIGGRAPH 2011 co-author" --> BJ
    MvP -- "SIGGRAPH 2011 co-author" --> LR
    MvP -- "SIGGRAPH 2011 co-author" --> AK
    SC -- "SIGGRAPH 2011 co-author" --> BJ
    SC -- "SIGGRAPH 2011 co-author" --> LR
    SC -- "SIGGRAPH 2011 co-author" --> MvP
    SC -- "SIGGRAPH 2011 co-author" --> AK
    BJ -- "SIGGRAPH 2011 co-author" --> LR
    BJ -- "SIGGRAPH 2011 co-author" --> MvP
    BJ -- "SIGGRAPH 2011 co-author" --> SC
    BJ -- "SIGGRAPH 2011 co-author" --> AK
    GT -- "CVPR 2014 co-author" --> SS
    GT -- "CVPR 2014 co-author" --> ThL
    GT -- "CVPR 2014 co-author" --> RaS
    GT -- "CVPR 2014 co-author" --> FFL
    GT -- "CVPR 2014 co-author" --> AK
    SS -- "CVPR 2014 co-author" --> ThL
    SS -- "CVPR 2014 co-author" --> RaS
    SS -- "CVPR 2014 co-author" --> FFL
    SS -- "CVPR 2014 co-author" --> AK
    ThL -- "CVPR 2014 co-author" --> RaS
    ThL -- "CVPR 2014 co-author" --> FFL
    ThL -- "CVPR 2014 co-author" --> AK
    RaS -- "CVPR 2014 co-author" --> FFL
    RaS -- "CVPR 2014 co-author" --> AK
    TL -- "NeurTalk2 co-author" --> PL
    TL -- "NeurTalk2 co-author" --> AK
    LF -- "Podcast guest" --> AK
    DW -- "Podcast guest" --> AK
    NB -- "RE·WORK Summit 2017" --> AK
    JH -- "NVIDIA GTC 2015" --> AK

    OR -- "ILSVRC co-author" --> JD
    OR -- "ILSVRC co-author" --> HS
    OR -- "ILSVRC co-author" --> JK
    OR -- "ILSVRC co-author" --> ACh
    OR -- "ILSVRC co-author" --> ACB
    OR -- "ILSVRC co-author" --> FFL
    OR -- "ILSVRC co-author" --> AK
    JD -- "ILSVRC co-author" --> HS
    JD -- "ILSVRC co-author" --> JK
    JD -- "ILSVRC co-author" --> ACh
    JD -- "ILSVRC co-author" --> ACB
    JD -- "ILSVRC co-author" --> FFL
    JD -- "ILSVRC co-author" --> AK
    HS -- "ILSVRC co-author" --> JK
    HS -- "ILSVRC co-author" --> ACh
    HS -- "ILSVRC co-author" --> ACB
    HS -- "ILSVRC co-author" --> FFL
    HS -- "ILSVRC co-author" --> AK
    JK -- "ILSVRC co-author" --> ACh
    JK -- "ILSVRC co-author" --> ACB
    JK -- "ILSVRC co-author" --> FFL
    JK -- "ILSVRC co-author" --> AK
    ACh -- "ILSVRC co-author" --> ACB
    ACh -- "ILSVRC co-author" --> FFL
    ACh -- "ILSVRC co-author" --> AK
    ACB -- "ILSVRC co-author" --> FFL
    ACB -- "ILSVRC co-author" --> AK
```

## Connection Registry

| Person A | Connection | Person B | Description & Context |
|----------|-----------|----------|-----------------------|
| [[Andrej Karpathy]] | PhD advisor | [[Fei-Fei Li]] | Karpathy's primary PhD advisor at Stanford Vision Lab |
| [[Andrej Karpathy]] | Rotation advisor | [[Daphne Koller]] | First-year PhD rotation at Stanford |
| [[Andrej Karpathy]] | Rotation advisor | [[Andrew Ng]] | First-year PhD rotation at Stanford |
| [[Andrej Karpathy]] | Rotation advisor | [[Sebastian Thrun]] | First-year PhD rotation at Stanford |
| [[Andrej Karpathy]] | Rotation advisor | [[Vladlen Koltun]] | First-year PhD rotation at Stanford |
| [[Andrej Karpathy]] | MSc supervisor | [[Michiel van de Panne]] | UBC MSc advisor (2009–2011), supervised learning controllers for simulated figures |
| [[Andrej Karpathy]] | Influenced by (classes) | [[Geoffrey Hinton]] | Attended Hinton's deep learning classes and reading groups at UBC (2005–2009) |
| [[Andrej Karpathy]] | DeepMind colleague | [[Koray Kavukcuoglu]] | Karpathy's research internship at DeepMind (2015) |
| [[Andrej Karpathy]] | DeepMind colleague | [[Vlad Mnih]] | DeepMind research team (2015) |
| [[Andrej Karpathy]] | Conference appearance | [[Jensen Huang]] | NVIDIA GTC 2015 keynote appearance together |
| [[Andrej Karpathy]] | Podcast guest | [[Pieter Abbeel]] | Robot Brains Podcast (2021) |
| [[Andrej Karpathy]] | DenseCap co-author | [[Justin Johnson]] | DenseCap (CVPR 2016 Oral) and Visualizing/Understanding Recurrent Networks (ICLR 2016 Workshop) |
| [[Andrej Karpathy]] | PixelCNN++ co-author | [[Tim Salimans]] | PixelCNN++ (ICLR 2017) |
| [[Andrej Karpathy]] | PixelCNN++ co-author | [[Xi Chen]] | PixelCNN++ (ICLR 2017) |
| [[Andrej Karpathy]] | PixelCNN++ co-author | [[Diederik P. Kingma]] | PixelCNN++ (ICLR 2017) |
| [[Andrej Karpathy]] | PixelCNN++ co-author | [[Yaroslav Bulatov]] | PixelCNN++ (ICLR 2017) |
| [[Andrej Karpathy]] | Grounded Compositional Semantics co-author | [[Richard Socher]] | TACL 2013, during Karpathy's Google Research internship |
| [[Andrej Karpathy]] | Grounded Compositional Semantics co-author | [[Quoc V. Le]] | TACL 2013, during Karpathy's Google Research internship |
| [[Andrej Karpathy]] | Grounded Compositional Semantics co-author | [[Christopher D. Manning]] | TACL 2013, during Karpathy's Google Research internship |
| [[Andrej Karpathy]] | NIPS 2012 co-author | [[Adam Coates]] | "Emergence of Object-Selective Features in Unsupervised Feature Learning" |
| [[Andrej Karpathy]] | Podcast interviewee | [[Lex Fridman]] | Lex Fridman Podcast (2022) |
| [[Andrej Karpathy]] | Podcast interviewee | [[Dwarlesh]] | Podcast interview (2025) |
| [[Andrej Karpathy]] | Conference appearance | [[Nathan Benaich]] | RE·WORK Summit (2017) |
| [[Andrej Karpathy]] | NeurTalk2 co-author | [[Tianlin Shi]] | Image captioning system |
| [[Andrej Karpathy]] | NeurTalk2 co-author | [[Percy Liang]] | Image captioning system |
| [[Fei-Fei Li]] | ILSVRC co-author | [[Olga Russakovsky]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Fei-Fei Li]] | ILSVRC co-author | [[Jia Deng]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Fei-Fei Li]] | ILSVRC co-author | [[Hao Su]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Fei-Fei Li]] | ILSVRC co-author | [[Jonathan Krause]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Fei-Fei Li]] | ILSVRC co-author | [[Aditya Khosla]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Fei-Fei Li]] | ILSVRC co-author | [[Alexander C. Berg]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Fei-Fei Li]] | CVPR 2014 co-author | [[George Toderici]] | Large-Scale Video Classification with CNNs |
| [[Fei-Fei Li]] | CVPR 2014 co-author | [[Sanketh Shetty]] | Large-Scale Video Classification with CNNs |
| [[Fei-Fei Li]] | CVPR 2014 co-author | [[Thomas Leung]] | Large-Scale Video Classification with CNNs |
| [[Fei-Fei Li]] | CVPR 2014 co-author | [[Rahul Sukthankar]] | Large-Scale Video Classification with CNNs |
| [[Fei-Fei Li]] | ICRA 2013 co-author | [[Stephen Miller]] | Object Discovery in 3D Scenes via Shape Analysis |
| [[Andrew Ng]] | Adam optimizer co-creator | [[Diederik P. Kingma]] | Co-creators of the Adam optimization algorithm |
| [[Andrew Ng]] | NIPS 2012 co-author | [[Adam Coates]] | "Emergence of Object-Selective Features in Unsupervised Feature Learning" |
| [[Andrew Ng]] | Grounded Compositional Semantics co-author | [[Richard Socher]] | TACL 2013 |
| [[Andrew Ng]] | Grounded Compositional Semantics co-author | [[Quoc V. Le]] | TACL 2013 |
| [[Andrew Ng]] | Grounded Compositional Semantics co-author | [[Christopher D. Manning]] | TACL 2013 |
| [[Andrew Ng]] | Rotation advisor | [[Daphne Koller]] | Stanford rotation advising program (2011–2017) |
| [[Andrew Ng]] | Rotation advisor | [[Sebastian Thrun]] | Stanford rotation advising program (2011–2017) |
| [[Andrew Ng]] | Rotation advisor | [[Vladlen Koltun]] | Stanford rotation advising program (2011–2017) |
| [[Andrew Ng]] | Rotation advisor | [[Fei-Fei Li]] | Stanford rotation advising program (2011–2017) |
| [[DeepMind team]] | DeepMind colleague | [[Vlad Mnih]] | Deep reinforcement learning research (2015) |
| [[DeepMind team]] | DeepMind colleague | [[Koray Kavukcuoglu]] | Deep reinforcement learning research (2015) |
| [[DeepMind team]] | DeepMind colleague | [[Geoffrey Hinton]] | Deep reinforcement learning research (2015) |
| [[DeepMind team]] | DeepMind colleague | [[Andrej Karpathy]] | Research intern at DeepMind (2015) |
| [[Stanford Vision Lab]] | ILSVRC co-author | [[Olga Russakovsky]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Stanford Vision Lab]] | ILSVRC co-author | [[Jia Deng]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Stanford Vision Lab]] | ILSVRC co-author | [[Hao Su]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Stanford Vision Lab]] | ILSVRC co-author | [[Jonathan Krause]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Stanford Vision Lab]] | ILSVRC co-author | [[Aditya Khosla]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Stanford Vision Lab]] | ILSVRC co-author | [[Alexander C. Berg]] | ImageNet Large Scale Visual Recognition Challenge paper (JMLR 2015) |
| [[Stanford Vision Lab]] | CVPR 2014 co-author | [[George Toderici]] | Large-Scale Video Classification with CNNs |
| [[Stanford Vision Lab]] | CVPR 2014 co-author | [[Sanketh Shetty]] | Large-Scale Video Classification with CNNs |
| [[Stanford Vision Lab]] | CVPR 2014 co-author | [[Thomas Leung]] | Large-Scale Video Classification with CNNs |
| [[Stanford Vision Lab]] | CVPR 2014 co-author | [[Rahul Sukthankar]] | Large-Scale Video Classification with CNNs |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Michiel van de Panne]] | Locomotion Skills for Simulated Quadrupeds |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Stelian Coros]] | Locomotion Skills for Simulated Quadrupeds |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Benjamin Jones]] | Locomotion Skills for Simulated Quadrupeds |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Lionel Reveret]] | Locomotion Skills for Simulated Quadrupeds |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Andrej Karpathy]] | Locomotion Skills for Simulated Quadrupeds |
| [[PixelCNN++ authors]] | ICLR 2017 co-author | [[Tim Salimans]] | PixelCNN++: A PixelCNN Implementation with Discretized Logistic Mixture Likelihood |
| [[PixelCNN++ authors]] | ICLR 2017 co-author | [[Xi Chen]] | PixelCNN++ (ICLR 2017) |
| [[PixelCNN++ authors]] | ICLR 2017 co-author | [[Diederik P. Kingma]] | PixelCNN++ (ICLR 2017) |
| [[PixelCNN++ authors]] | ICLR 2017 co-author | [[Yaroslav Bulatov]] | PixelCNN++ (ICLR 2017) |
| [[PixelCNN++ authors]] | ICLR 2017 co-author | [[Andrej Karpathy]] | PixelCNN++ (ICLR 2017) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Stelian Coros]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Benjamin Jones]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Lionel Reveret]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Michiel van de Panne]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Andrej Karpathy]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Benjamin Jones]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Lionel Reveret]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Michiel van de Panne]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Stelian Coros]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Andrej Karpathy]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Lionel Reveret]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Benjamin Jones]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Michiel van de Panne]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Stelian Coros]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Andrej Karpathy]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Benjamin Jones]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Lionel Reveret]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Stelian Coros]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Michiel van de Panne]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
| [[UBC Robotics Group]] | SIGGRAPH 2011 co-author | [[Andrej Karpathy]] | Locomotion Skills for Simulated Quadrupeds (SIGGRAPH 2011) |
