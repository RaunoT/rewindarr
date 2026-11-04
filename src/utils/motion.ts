export const slideDown = {
  hidden: {
    opacity: 0,
    y: 50,
  },
  show: {
    opacity: 1,
    y: 0,
  },
}

// A countdown's next place comes in from above, over the places it pushes down
export const countdownRow = {
  hidden: {
    opacity: 0,
    y: -30,
  },
  show: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
}

export const fadeIn = {
  hidden: {
    opacity: 0,
  },
  show: {
    opacity: 1,
  },
}

export const animateRewindStat = {
  hidden: {
    opacity: 0,
    y: 50,
  },
  show: {
    opacity: 1,
    y: 0,
  },
  scaleDown: {
    opacity: 0.5,
    fontSize: '20px',
    lineHeight: '22px',
  },
}

export const instantTransition = {
  duration: 0,
}
