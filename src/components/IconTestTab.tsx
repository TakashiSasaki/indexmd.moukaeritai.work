import React from 'react';

export const IconTestTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">アイコンテスト</h3>
            <p className="text-sm text-slate-500 mt-1">SVGアイコンのレンダリングテスト</p>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-8 justify-center p-8 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">512x512 (Original)</span>
              <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
                <title id="title">indexmd app icon</title>
                <desc id="desc">A rounded app icon showing a folder, an index.md document, structured list lines, and an AI sparkle.</desc>
                <defs>
                  <linearGradient id="bg" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#4F46E5"/>
                    <stop offset="0.55" stopColor="#2563EB"/>
                    <stop offset="1" stopColor="#10B981"/>
                  </linearGradient>
                  <linearGradient id="folder" x1="112" y1="142" x2="400" y2="354" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#F8FAFC"/>
                    <stop offset="1" stopColor="#DDEAFE"/>
                  </linearGradient>

                  <linearGradient id="doc" x1="176" y1="154" x2="360" y2="398" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#FFFFFF"/>
                    <stop offset="1" stopColor="#EEF2FF"/>
                  </linearGradient>

                  <filter id="softShadow" x="40" y="40" width="432" height="432" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feDropShadow dx="0" dy="18" stdDeviation="22" floodColor="#0F172A" floodOpacity="0.28"/>
                  </filter>

                  <filter id="innerShadow" x="80" y="120" width="352" height="300" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1E293B" floodOpacity="0.16"/>
                  </filter>
                </defs>
                <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#bg)"/>
                <path d="M94 376C94 250 184 138 306 98C374 76 442 96 454 154C469 226 398 312 336 358C268 408 162 432 114 406C101 399 94 388 94 376Z" fill="#FFFFFF" opacity="0.10"/>
                <g filter="url(#softShadow)">
                  <path d="M102 178C102 157.013 119.013 140 140 140H210C223.5 140 228.5 148 238 158L256 176H372C393.539 176 411 193.461 411 215V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V178Z" fill="url(#folder)"/>
                  <path d="M102 215C102 193.461 119.461 176 141 176H371C393.091 176 411 193.909 411 216V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V215Z" fill="#E0F2FE" opacity="0.66"/>
                </g>
                <g filter="url(#innerShadow)">
                  <path d="M164 142C164 128.745 174.745 118 188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142Z" fill="url(#doc)"/>
                  <path d="M321 118V151C321 157.075 325.925 162 332 162H365L321 118Z" fill="#C7D2FE"/>
                  <path d="M188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142C164 128.745 174.745 118 188 118Z" stroke="#FFFFFF" strokeWidth="8" opacity="0.72"/>
                </g>
                <path d="M203 193H293" stroke="#1E293B" strokeWidth="17" strokeLinecap="round"/>
                <path d="M203 227H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 263H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 299H289" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <circle cx="190" cy="227" r="5" fill="#10B981"/>
                <circle cx="190" cy="263" r="5" fill="#10B981"/>
                <circle cx="190" cy="299" r="5" fill="#10B981"/>
                <path d="M212 350H252" stroke="#4F46E5" strokeWidth="16" strokeLinecap="round"/>
                <path d="M272 350H318" stroke="#10B981" strokeWidth="16" strokeLinecap="round"/>
                <path d="M212 350L212 328" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round"/>
                <path d="M318 350L318 328" stroke="#10B981" strokeWidth="10" strokeLinecap="round"/>
                <path d="M393 113L404 142L433 153L404 164L393 193L382 164L353 153L382 142L393 113Z" fill="#FDE68A"/>
                <path d="M409 77L416 95L434 102L416 109L409 127L402 109L384 102L402 95L409 77Z" fill="#FFFFFF" opacity="0.92"/>
                <path d="M121 118L127 133L142 139L127 145L121 160L115 145L100 139L115 133L121 118Z" fill="#D1FAE5" opacity="0.9"/>
                <path d="M159 389H365" stroke="#0F172A" strokeOpacity="0.12" strokeWidth="10" strokeLinecap="round"/>
              </svg>
            </div>

            <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">256x256</span>
              <svg width="256" height="256" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
                <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#bg)"/>
                <path d="M94 376C94 250 184 138 306 98C374 76 442 96 454 154C469 226 398 312 336 358C268 408 162 432 114 406C101 399 94 388 94 376Z" fill="#FFFFFF" opacity="0.10"/>
                <g filter="url(#softShadow)">
                  <path d="M102 178C102 157.013 119.013 140 140 140H210C223.5 140 228.5 148 238 158L256 176H372C393.539 176 411 193.461 411 215V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V178Z" fill="url(#folder)"/>
                  <path d="M102 215C102 193.461 119.461 176 141 176H371C393.091 176 411 193.909 411 216V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V215Z" fill="#E0F2FE" opacity="0.66"/>
                </g>
                <g filter="url(#innerShadow)">
                  <path d="M164 142C164 128.745 174.745 118 188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142Z" fill="url(#doc)"/>
                  <path d="M321 118V151C321 157.075 325.925 162 332 162H365L321 118Z" fill="#C7D2FE"/>
                  <path d="M188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142C164 128.745 174.745 118 188 118Z" stroke="#FFFFFF" strokeWidth="8" opacity="0.72"/>
                </g>
                <path d="M203 193H293" stroke="#1E293B" strokeWidth="17" strokeLinecap="round"/>
                <path d="M203 227H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 263H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 299H289" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <circle cx="190" cy="227" r="5" fill="#10B981"/>
                <circle cx="190" cy="263" r="5" fill="#10B981"/>
                <circle cx="190" cy="299" r="5" fill="#10B981"/>
                <path d="M212 350H252" stroke="#4F46E5" strokeWidth="16" strokeLinecap="round"/>
                <path d="M272 350H318" stroke="#10B981" strokeWidth="16" strokeLinecap="round"/>
                <path d="M212 350L212 328" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round"/>
                <path d="M318 350L318 328" stroke="#10B981" strokeWidth="10" strokeLinecap="round"/>
                <path d="M393 113L404 142L433 153L404 164L393 193L382 164L353 153L382 142L393 113Z" fill="#FDE68A"/>
                <path d="M409 77L416 95L434 102L416 109L409 127L402 109L384 102L402 95L409 77Z" fill="#FFFFFF" opacity="0.92"/>
                <path d="M121 118L127 133L142 139L127 145L121 160L115 145L100 139L115 133L121 118Z" fill="#D1FAE5" opacity="0.9"/>
                <path d="M159 389H365" stroke="#0F172A" strokeOpacity="0.12" strokeWidth="10" strokeLinecap="round"/>
              </svg>
            </div>

            <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">128x128</span>
              <svg width="128" height="128" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
                <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#bg)"/>
                <path d="M94 376C94 250 184 138 306 98C374 76 442 96 454 154C469 226 398 312 336 358C268 408 162 432 114 406C101 399 94 388 94 376Z" fill="#FFFFFF" opacity="0.10"/>
                <g filter="url(#softShadow)">
                  <path d="M102 178C102 157.013 119.013 140 140 140H210C223.5 140 228.5 148 238 158L256 176H372C393.539 176 411 193.461 411 215V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V178Z" fill="url(#folder)"/>
                  <path d="M102 215C102 193.461 119.461 176 141 176H371C393.091 176 411 193.909 411 216V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V215Z" fill="#E0F2FE" opacity="0.66"/>
                </g>
                <g filter="url(#innerShadow)">
                  <path d="M164 142C164 128.745 174.745 118 188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142Z" fill="url(#doc)"/>
                  <path d="M321 118V151C321 157.075 325.925 162 332 162H365L321 118Z" fill="#C7D2FE"/>
                  <path d="M188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142C164 128.745 174.745 118 188 118Z" stroke="#FFFFFF" strokeWidth="8" opacity="0.72"/>
                </g>
                <path d="M203 193H293" stroke="#1E293B" strokeWidth="17" strokeLinecap="round"/>
                <path d="M203 227H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 263H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 299H289" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <circle cx="190" cy="227" r="5" fill="#10B981"/>
                <circle cx="190" cy="263" r="5" fill="#10B981"/>
                <circle cx="190" cy="299" r="5" fill="#10B981"/>
                <path d="M212 350H252" stroke="#4F46E5" strokeWidth="16" strokeLinecap="round"/>
                <path d="M272 350H318" stroke="#10B981" strokeWidth="16" strokeLinecap="round"/>
                <path d="M212 350L212 328" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round"/>
                <path d="M318 350L318 328" stroke="#10B981" strokeWidth="10" strokeLinecap="round"/>
                <path d="M393 113L404 142L433 153L404 164L393 193L382 164L353 153L382 142L393 113Z" fill="#FDE68A"/>
                <path d="M409 77L416 95L434 102L416 109L409 127L402 109L384 102L402 95L409 77Z" fill="#FFFFFF" opacity="0.92"/>
                <path d="M121 118L127 133L142 139L127 145L121 160L115 145L100 139L115 133L121 118Z" fill="#D1FAE5" opacity="0.9"/>
                <path d="M159 389H365" stroke="#0F172A" strokeOpacity="0.12" strokeWidth="10" strokeLinecap="round"/>
              </svg>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">64x64</span>
              <svg width="64" height="64" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
                <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#bg)"/>
                <path d="M94 376C94 250 184 138 306 98C374 76 442 96 454 154C469 226 398 312 336 358C268 408 162 432 114 406C101 399 94 388 94 376Z" fill="#FFFFFF" opacity="0.10"/>
                <g filter="url(#softShadow)">
                  <path d="M102 178C102 157.013 119.013 140 140 140H210C223.5 140 228.5 148 238 158L256 176H372C393.539 176 411 193.461 411 215V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V178Z" fill="url(#folder)"/>
                  <path d="M102 215C102 193.461 119.461 176 141 176H371C393.091 176 411 193.909 411 216V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V215Z" fill="#E0F2FE" opacity="0.66"/>
                </g>
                <g filter="url(#innerShadow)">
                  <path d="M164 142C164 128.745 174.745 118 188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142Z" fill="url(#doc)"/>
                  <path d="M321 118V151C321 157.075 325.925 162 332 162H365L321 118Z" fill="#C7D2FE"/>
                  <path d="M188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142C164 128.745 174.745 118 188 118Z" stroke="#FFFFFF" strokeWidth="8" opacity="0.72"/>
                </g>
                <path d="M203 193H293" stroke="#1E293B" strokeWidth="17" strokeLinecap="round"/>
                <path d="M203 227H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 263H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 299H289" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <circle cx="190" cy="227" r="5" fill="#10B981"/>
                <circle cx="190" cy="263" r="5" fill="#10B981"/>
                <circle cx="190" cy="299" r="5" fill="#10B981"/>
                <path d="M212 350H252" stroke="#4F46E5" strokeWidth="16" strokeLinecap="round"/>
                <path d="M272 350H318" stroke="#10B981" strokeWidth="16" strokeLinecap="round"/>
                <path d="M212 350L212 328" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round"/>
                <path d="M318 350L318 328" stroke="#10B981" strokeWidth="10" strokeLinecap="round"/>
                <path d="M393 113L404 142L433 153L404 164L393 193L382 164L353 153L382 142L393 113Z" fill="#FDE68A"/>
                <path d="M409 77L416 95L434 102L416 109L409 127L402 109L384 102L402 95L409 77Z" fill="#FFFFFF" opacity="0.92"/>
                <path d="M121 118L127 133L142 139L127 145L121 160L115 145L100 139L115 133L121 118Z" fill="#D1FAE5" opacity="0.9"/>
                <path d="M159 389H365" stroke="#0F172A" strokeOpacity="0.12" strokeWidth="10" strokeLinecap="round"/>
              </svg>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">32x32</span>
              <svg width="32" height="32" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
                <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#bg)"/>
                <path d="M94 376C94 250 184 138 306 98C374 76 442 96 454 154C469 226 398 312 336 358C268 408 162 432 114 406C101 399 94 388 94 376Z" fill="#FFFFFF" opacity="0.10"/>
                <g filter="url(#softShadow)">
                  <path d="M102 178C102 157.013 119.013 140 140 140H210C223.5 140 228.5 148 238 158L256 176H372C393.539 176 411 193.461 411 215V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V178Z" fill="url(#folder)"/>
                  <path d="M102 215C102 193.461 119.461 176 141 176H371C393.091 176 411 193.909 411 216V348C411 370.091 393.091 388 371 388H141C119.461 388 102 370.539 102 349V215Z" fill="#E0F2FE" opacity="0.66"/>
                </g>
                <g filter="url(#innerShadow)">
                  <path d="M164 142C164 128.745 174.745 118 188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142Z" fill="url(#doc)"/>
                  <path d="M321 118V151C321 157.075 325.925 162 332 162H365L321 118Z" fill="#C7D2FE"/>
                  <path d="M188 118H321L365 162V394C365 407.255 354.255 418 341 418H188C174.745 418 164 407.255 164 394V142C164 128.745 174.745 118 188 118Z" stroke="#FFFFFF" strokeWidth="8" opacity="0.72"/>
                </g>
                <path d="M203 193H293" stroke="#1E293B" strokeWidth="17" strokeLinecap="round"/>
                <path d="M203 227H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 263H326" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <path d="M203 299H289" stroke="#64748B" strokeWidth="13" strokeLinecap="round"/>
                <circle cx="190" cy="227" r="5" fill="#10B981"/>
                <circle cx="190" cy="263" r="5" fill="#10B981"/>
                <circle cx="190" cy="299" r="5" fill="#10B981"/>
                <path d="M212 350H252" stroke="#4F46E5" strokeWidth="16" strokeLinecap="round"/>
                <path d="M272 350H318" stroke="#10B981" strokeWidth="16" strokeLinecap="round"/>
                <path d="M212 350L212 328" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round"/>
                <path d="M318 350L318 328" stroke="#10B981" strokeWidth="10" strokeLinecap="round"/>
                <path d="M393 113L404 142L433 153L404 164L393 193L382 164L353 153L382 142L393 113Z" fill="#FDE68A"/>
                <path d="M409 77L416 95L434 102L416 109L409 127L402 109L384 102L402 95L409 77Z" fill="#FFFFFF" opacity="0.92"/>
                <path d="M121 118L127 133L142 139L127 145L121 160L115 145L100 139L115 133L121 118Z" fill="#D1FAE5" opacity="0.9"/>
                <path d="M159 389H365" stroke="#0F172A" strokeOpacity="0.12" strokeWidth="10" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
