import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { renderAsync } from '@resvg/resvg-js';
import type { BriefingImage } from './briefing-image';

// 随应用携带字体，避免无中文字体的 Linux 把事件渲染为空白或方框。
const fontFiles = [
  path.join(process.cwd(), 'assets/fonts/NotoSansSC-Regular.otf'),
  path.join(process.cwd(), 'assets/fonts/NotoSansSC-Bold.otf'),
];

/** 保留 SVG 模板和逻辑尺寸，用双倍像素输出，供钉钉原生图片组件读取。 */
export const renderBriefingPng = async (image: BriefingImage): Promise<Buffer> => {
  // resvg 会忽略不存在的字体；这里明确失败，避免把缺字图误当成成功响应。
  await Promise.all(fontFiles.map(file => access(file, constants.R_OK)));
  const rendered = await renderAsync(image.svg, {
    fitTo: { mode: 'width', value: image.width * 2 },
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: 'Noto Sans SC',
      sansSerifFamily: 'Noto Sans SC',
    },
  });
  return rendered.asPng();
};
