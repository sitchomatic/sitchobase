function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load screenshot for pixel comparison'));
    img.src = url;
  });
}

export async function compareScreenshotPixels(currentUrl, baselineUrl, maxWidth = 420) {
  if (!currentUrl || !baselineUrl) return null;

  const [current, baseline] = await Promise.all([loadImage(currentUrl), loadImage(baselineUrl)]);
  const scale = Math.min(1, maxWidth / Math.max(current.naturalWidth, baseline.naturalWidth));
  const width = Math.max(1, Math.round(Math.min(current.naturalWidth, baseline.naturalWidth) * scale));
  const height = Math.max(1, Math.round(Math.min(current.naturalHeight, baseline.naturalHeight) * scale));

  const canvas = document.createElement('canvas');
  const baseCanvas = document.createElement('canvas');
  const currentCanvas = document.createElement('canvas');
  canvas.width = baseCanvas.width = currentCanvas.width = width;
  canvas.height = baseCanvas.height = currentCanvas.height = height;

  const baseCtx = baseCanvas.getContext('2d');
  const currentCtx = currentCanvas.getContext('2d');
  const diffCtx = canvas.getContext('2d');

  baseCtx.drawImage(baseline, 0, 0, width, height);
  currentCtx.drawImage(current, 0, 0, width, height);

  const baseData = baseCtx.getImageData(0, 0, width, height);
  const currentData = currentCtx.getImageData(0, 0, width, height);
  const diffData = diffCtx.createImageData(width, height);

  let changed = 0;
  const threshold = 42;

  for (let i = 0; i < currentData.data.length; i += 4) {
    const dr = Math.abs(currentData.data[i] - baseData.data[i]);
    const dg = Math.abs(currentData.data[i + 1] - baseData.data[i + 1]);
    const db = Math.abs(currentData.data[i + 2] - baseData.data[i + 2]);
    const delta = dr + dg + db;
    const isChanged = delta > threshold;

    if (isChanged) changed += 1;
    diffData.data[i] = isChanged ? 255 : Math.round(currentData.data[i] * 0.25);
    diffData.data[i + 1] = isChanged ? 45 : Math.round(currentData.data[i + 1] * 0.25);
    diffData.data[i + 2] = isChanged ? 45 : Math.round(currentData.data[i + 2] * 0.25);
    diffData.data[i + 3] = isChanged ? 255 : 170;
  }

  diffCtx.putImageData(diffData, 0, 0);

  return {
    diffUrl: canvas.toDataURL('image/png'),
    deviationPercent: Number(((changed / (width * height)) * 100).toFixed(2)),
    changedPixels: changed,
    totalPixels: width * height,
  };
}