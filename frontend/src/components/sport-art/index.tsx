// 运动的「场馆图 + 球 + 运动感」——首页大卡视觉主体。
// 每种运动的视觉指示不止靠颜色：
//   - 壁球：小黑球 + 弹墙弧（撞前墙 → 弹回）
//   - 足球：足球纹理 + 旋转弧（带球跑动）
//   - 篮球：篮球纹理 + 抛物线（投篮飞行轨迹）
// 全部用 SVG，可在白底或彩底上用 stroke + fill 自适配。
import type { SVGProps } from "react";
import type { SportType } from "@/lib/types";

type Props = SVGProps<SVGSVGElement> & {
  sport: SportType;
  stroke?: string;
  /** 球填充色（一般用纯白/纯黑，制造对比） */
  ballFill?: string;
};

const STROKE_W = 2.5;

/* ——— 壁球场（俯视）+ 黑球撞墙弧 ——— */
function SquashArt({
  stroke = "currentColor",
  ballFill = "currentColor",
  ...rest
}: SVGProps<SVGSVGElement> & { ballFill?: string }) {
  return (
    <svg viewBox="0 0 220 320" fill="none" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {/* 球场外框 */}
      <rect x="14" y="14" width="192" height="292" rx="2" />
      {/* 半场中线（前后半场） */}
      <line x1="14" y1="160" x2="206" y2="160" />
      {/* 前墙短线（标记发球区） */}
      <line x1="60" y1="14" x2="60" y2="160" />
      <line x1="160" y1="14" x2="160" y2="160" />
      <line x1="60" y1="14" x2="160" y2="14" />
      {/* 后场 T 字服务线 */}
      <line x1="80" y1="160" x2="80" y2="210" />
      <line x1="140" y1="160" x2="140" y2="210" />
      <line x1="80" y1="210" x2="140" y2="210" />
      <line x1="60" y1="240" x2="160" y2="240" />
      {/* 撞墙弹道：前墙 → 球 → 后场落点 */}
      <path d="M 110 28 L 110 70 Q 110 100 138 110" strokeDasharray="4 5" opacity="0.55" />
      {/* 球（黑色实心，经典壁球质感） */}
      <circle cx="138" cy="110" r="9" fill={ballFill} stroke={stroke} strokeWidth="2" />
      <circle cx="135" cy="107" r="0.9" fill="white" stroke="none" />
      <circle cx="141" cy="113" r="0.9" fill="white" stroke="none" />
    </svg>
  );
}

/* ——— 足球场（俯视）+ 足球带旋转线 ——— */
function FootballArt({
  stroke = "currentColor",
  ballFill = "currentColor",
  ...rest
}: SVGProps<SVGSVGElement> & { ballFill?: string }) {
  return (
    <svg viewBox="0 0 220 320" fill="none" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {/* 球场外框 */}
      <rect x="6" y="14" width="208" height="292" rx="2" />
      {/* 中圈 + 中点 */}
      <circle cx="110" cy="160" r="44" />
      <circle cx="110" cy="160" r="3" fill={stroke} stroke="none" />
      {/* 中线 */}
      <line x1="6" y1="160" x2="214" y2="160" />
      {/* 顶/底 禁区 */}
      <rect x="40" y="14" width="140" height="58" />
      <rect x="65" y="14" width="90" height="24" />
      <rect x="40" y="248" width="140" height="58" />
      <rect x="65" y="282" width="90" height="24" />
      {/* 点球点 */}
      <circle cx="110" cy="48" r="2.4" fill={stroke} stroke="none" />
      <circle cx="110" cy="272" r="2.4" fill={stroke} stroke="none" />
      {/* 角球弧 */}
      <path d="M 6 30 Q 22 18 34 18" />
      <path d="M 214 30 Q 198 18 186 18" />
      <path d="M 6 290 Q 22 302 34 302" />
      <path d="M 214 290 Q 198 302 186 302" />
      {/* 球：黑白块纹理（5 边形简化） */}
      <g transform="translate(155, 110)">
        <circle r="14" fill={ballFill} stroke={stroke} strokeWidth="2" />
        <polygon points="0,-7 6,-3 4,5 -4,5 -6,-3" fill="white" stroke="none" />
        <line x1="-7" y1="0" x2="7" y2="0" stroke="white" strokeWidth="1.4" />
        <line x1="0" y1="-7" x2="0" y2="7" stroke="white" strokeWidth="1.4" />
      </g>
      {/* 运动轨迹：球从中心圈出发的弧线 */}
      <path d="M 110 160 Q 130 130 155 110" strokeDasharray="3 4" opacity="0.55" />
    </svg>
  );
}

/* ——— 篮球场（俯视）+ 篮球飞行抛物线 ——— */
function BasketballArt({
  stroke = "currentColor",
  ballFill = "currentColor",
  ...rest
}: SVGProps<SVGSVGElement> & { ballFill?: string }) {
  return (
    <svg viewBox="0 0 220 320" fill="none" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {/* 球场外框 */}
      <rect x="20" y="14" width="180" height="292" rx="2" />
      {/* 中线 */}
      <line x1="110" y1="14" x2="110" y2="306" />
      {/* 罚球线 + 油漆区 */}
      <rect x="58" y="14" width="104" height="80" />
      <rect x="58" y="226" width="104" height="80" />
      {/* 罚球弧 */}
      <path d="M 58 70 A 52 52 0 0 0 162 70" />
      <path d="M 58 250 A 52 52 0 0 1 162 250" />
      {/* 三分弧 */}
      <path d="M 28 14 A 100 100 0 0 1 192 14" />
      <path d="M 28 306 A 100 100 0 0 0 192 306" />
      {/* 中心圆 */}
      <circle cx="110" cy="160" r="22" />
      <circle cx="110" cy="160" r="2.4" fill={stroke} stroke="none" />
      {/* 篮筐（左上 + 右下） */}
      <g transform="translate(110, 30)">
        <rect x="-14" y="-3" width="28" height="3" fill="none" stroke={stroke} />
        <line x1="-14" y1="-3" x2="-14" y2="0" />
        <line x1="14" y1="-3" x2="14" y2="0" />
      </g>
      {/* 篮球 + 抛物线：从右下方向左上方篮筐 */}
      <g transform="translate(150, 240)">
        <circle r="13" fill={ballFill} stroke={stroke} strokeWidth="2" />
        <path d="M -13 0 A 13 13 0 0 1 13 0" stroke="white" strokeWidth="1.6" fill="none" />
        <path d="M 0 -13 A 13 13 0 0 0 0 13" stroke="white" strokeWidth="1.6" fill="none" />
        <line x1="-13" y1="0" x2="13" y2="0" stroke="white" strokeWidth="1.6" />
      </g>
      <path d="M 150 240 Q 100 100 110 30" strokeDasharray="3 4" opacity="0.55" />
    </svg>
  );
}

export function SportArt({ sport, ...rest }: Props) {
  switch (sport) {
    case "squash":     return <SquashArt     {...rest} />;
    case "football":   return <FootballArt   {...rest} />;
    case "basketball": return <BasketballArt {...rest} />;
    default:
      return (
        <svg viewBox="0 0 220 320" fill="none" stroke="currentColor" strokeWidth={STROKE_W} {...rest}>
          <rect x="20" y="20" width="180" height="280" />
        </svg>
      );
  }
}
