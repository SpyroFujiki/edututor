import { useId } from 'react'

const stars = [
  [40, 45, 2],
  [76, 156, 1.6],
  [111, 30, 1],
  [151, 74, 1.5],
  [184, 20, 1],
  [270, 34, 1.5],
  [326, 23, 2],
  [389, 55, 1],
  [410, 132, 1.5],
  [368, 201, 2],
  [294, 211, 1],
  [133, 207, 2],
  [52, 214, 1],
  [405, 222, 1],
  [21, 114, 1],
  [333, 145, 1],
]

export default function ThemeScene({ className = '' }) {
  const id = useId()
  return (
    <div className={`theme-scene ${className}`} aria-hidden="true">
      <svg
        className="theme-light-only botanical-scene"
        viewBox="0 0 440 240"
        fill="none"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={`${id}-leaf`}
            x1="150"
            y1="45"
            x2="270"
            y2="205"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#9ebd70" />
            <stop offset="1" stopColor="#347348" />
          </linearGradient>
          <radialGradient id={`${id}-sun`}>
            <stop stopColor="#f7edb6" />
            <stop offset="1" stopColor="#e3eab7" />
          </radialGradient>
        </defs>
        <path
          d="M31 218h378M46 230h347M46 20v12m-6-6h12M387 168v12m-6-6h12"
          stroke="#648253"
          opacity=".24"
        />
        <circle cx="307" cy="75" r="46" fill={`url(#${id}-sun)`} />
        <circle cx="307" cy="75" r="61" stroke="#a3b77e" strokeDasharray="2 7" opacity=".5" />
        <path d="M94 214c20-33 66-42 114-29 43-20 97-9 131 29" fill="#dbe8c9" />
        <path
          d="M220 210c-9-45-8-108 10-157"
          stroke="#2c6540"
          strokeWidth="3"
          strokeLinecap="round"
          className="plant-stem"
        />
        <g className="scene-leaves" fill={`url(#${id}-leaf)`} stroke="#39714a" strokeWidth="1.2">
          <path d="M216 166c-46 6-79-15-88-51 44 0 78 16 88 51Z" />
          <path d="M214 147c6-41 33-62 71-57-9 38-31 57-71 57Z" />
          <path d="M219 113c-33-7-49-31-43-60 30 9 47 28 43 60Z" />
          <path d="M227 81c2-27 18-42 43-39-5 24-18 38-43 39Z" />
        </g>
        <path
          d="m143 127 69 35m63-62-58 45m-36-80 35 43m46-59-31 27"
          stroke="#d9e6bc"
          strokeWidth="1.2"
          opacity=".7"
        />
        <g stroke="#688d53" strokeWidth="1.6" strokeLinecap="round">
          <path d="M94 216c2-19 0-34-9-49m8 28c-15-2-23-11-23-23 15 1 24 8 23 23m0-9c0-16 8-24 22-26-1 14-9 23-22 26" />
          <path d="M338 216c-2-14 0-27 7-38m-6 23c14-2 21-8 23-19-14 0-22 7-23 19" />
        </g>
        <path
          d="M162 203c18-6 37-4 58 6 22-10 41-12 58-6v18c-20-5-39-4-58 4-20-8-39-9-58-4v-18Z"
          fill="#f8faf1"
          stroke="#50754b"
          strokeWidth="1.5"
        />
        <path d="M220 210v15m-45-15 29 5m32 0 29-5" stroke="#90a578" />
        <g className="scene-motes" fill="#93ad68">
          <circle cx="136" cy="61" r="3" />
          <circle cx="352" cy="116" r="2" />
          <path d="m92 85 4 6-4 6-4-6 4-6Zm253-55 3 4-3 4-3-4 3-4Z" />
        </g>
      </svg>
      <svg
        className="theme-dark-only cosmos-scene"
        viewBox="0 0 440 240"
        fill="none"
        focusable="false"
      >
        <defs>
          <radialGradient id={`${id}-halo`}>
            <stop stopColor="#387395" stopOpacity=".32" />
            <stop offset="1" stopColor="#001f3f" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`${id}-planet`}
            x1="176"
            y1="73"
            x2="260"
            y2="173"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#34677b" />
            <stop offset=".5" stopColor="#123e5f" />
            <stop offset="1" stopColor="#05213e" />
          </linearGradient>
        </defs>
        <ellipse cx="220" cy="125" rx="200" ry="118" fill={`url(#${id}-halo)`} />
        <g>
          {stars.map(([x, y, r], index) => (
            <circle
              className="cosmos-star"
              key={index}
              cx={x}
              cy={y}
              r={r}
              fill={index % 3 === 0 ? '#ffd700' : '#f4f4f4'}
              style={{ '--spark': index }}
            />
          ))}
        </g>
        <path
          d="m302 45 36 19 25-27 29 32M47 174l38-23 24 23-11 28"
          stroke="#b6d4df"
          strokeOpacity=".18"
        />
        <g className="cosmos-orbit">
          <ellipse
            cx="220"
            cy="126"
            rx="172"
            ry="59"
            stroke="#ffd700"
            strokeOpacity=".3"
            transform="rotate(-22 220 126)"
          />
          <circle cx="363" cy="71" r="6" fill="#ffd700" />
        </g>
        <ellipse
          cx="220"
          cy="126"
          rx="105"
          ry="92"
          stroke="#b0cfdb"
          strokeOpacity=".12"
          transform="rotate(31 220 126)"
        />
        <circle
          cx="220"
          cy="123"
          r="61"
          fill={`url(#${id}-planet)`}
          stroke="#ffd700"
          strokeOpacity=".6"
        />
        <path
          d="M178 92c23 12 52 17 87 13m-102 21c35 16 72 19 113 7m-99 21c21 8 48 9 77 5"
          stroke="#87b6c6"
          strokeOpacity=".15"
        />
        <path
          d="M190 106c10-3 20-1 30 5 10-6 20-8 30-5v35c-11-3-21-1-30 5-9-6-19-8-30-5v-35Zm30 5v35"
          stroke="#ffd700"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m319 156 3 10 10 3-10 3-3 10-3-10-10-3 10-3 3-10ZM123 67l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z"
          fill="#ffd700"
          className="cosmos-star"
        />
        <path d="M42 224h65m226 0h65M42 220v8m356-8v8" stroke="#ffd700" strokeOpacity=".25" />
      </svg>
    </div>
  )
}

export function ThemeMotif() {
  return (
    <svg
      className="theme-motif"
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="theme-light-only" stroke="currentColor" strokeWidth="1.3">
        <path d="M82 161c-4-54 3-97 22-137M83 112C41 115 19 94 17 61c37 1 61 20 66 51Zm4-30c1-34 22-53 57-50-5 29-24 47-57 50ZM97 45C72 39 61 20 65 1c22 6 34 20 32 44Z" />
        <path d="m22 67 58 42m53-68L91 78M69 8l25 34" opacity=".5" />
      </g>
      <g className="theme-dark-only" stroke="currentColor">
        <circle cx="85" cy="77" r="35" />
        <ellipse cx="85" cy="77" rx="77" ry="24" transform="rotate(-30 85 77)" />
        <circle cx="140" cy="42" r="5" fill="currentColor" />
        <path d="M24 10v12m-6-6h12m91 110v10m-5-5h10" />
      </g>
    </svg>
  )
}
