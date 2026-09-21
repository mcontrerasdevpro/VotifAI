export function openVotingForPoint(points, index) {
  if (!Array.isArray(points) || index < 0 || index >= points.length) return points;

  return points.map((point, pointIndex) => {
    if (pointIndex === index) {
      return { ...point, estado: 'Votando' };
    }
    return point;
  });
}

export function closeCurrentPoint(points, index, totals = { si: 0, no: 0, abs: 0 }) {
  if (!Array.isArray(points) || index < 0 || index >= points.length) return points;

  const nextPoints = points.map((point, pointIndex) => {
    if (pointIndex === index) {
      return {
        ...point,
        estado: 'Cerrado',
        si: totals.si ?? point.si ?? 0,
        no: totals.no ?? point.no ?? 0,
        abs: totals.abs ?? point.abs ?? 0
      };
    }

    if (pointIndex === index + 1) {
      return { ...point, estado: 'Debatiendo' };
    }

    return point;
  });

  return nextPoints;
}

export function getNextPointIndex(points, currentIndex) {
  if (!Array.isArray(points) || points.length === 0) return 0;
  if (currentIndex >= points.length - 1) return points.length - 1;
  return currentIndex + 1;
}
