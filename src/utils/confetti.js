import confetti from 'canvas-confetti';

export const launchConfetti = () => {
    confetti({
        particleCount: 200,
        spread: 70,
        origin: { y: 0.6 }
    });
};
