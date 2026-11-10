
"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const destinations = [
  {
    city: "SEOUL · KOREA",
    title: "Seoul’s Hidden Corners",
    description:
      "A relaxed weekend of cafés, parks, and charming old streets.",
    image: "/destinations/seoul.jpg",
  },
  {
    city: "TOLEDO · SPAIN",
    title: "Timeless Toledo",
    description:
      "Discover historic streets and beautiful city views.",
    image: "/destinations/toledo.jpg",
  },
  {
    city: "TOKYO · JAPAN",
    title: "Tokyo After Dark",
    description:
      "Explore vibrant streets and unforgettable nights.",
    image: "/destinations/tokyo.jpg",
  },
];

export default function HomeDestinationSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const current = destinations[activeIndex];

  function moveSlide(direction: number) {
    setActiveIndex((previous) =>
      (previous + direction + destinations.length) %
      destinations.length
    );
  }

    function handleTouchStart(e: React.TouchEvent<HTMLElement>) {
        touchStartX.current = e.touches[0].clientX;
    }

    function handleTouchEnd(e: React.TouchEvent<HTMLElement>) {
        if (touchStartX.current === null) return;

        const difference =
            touchStartX.current - e.changedTouches[0].clientX;

        if (Math.abs(difference) > 50) {
            moveSlide(difference > 0 ? 1 : -1);
        }

        touchStartX.current = null;
    }

 return (
    <article
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative h-[300px] w-full touch-pan-y overflow-hidden rounded-[22px] bg-[#17181B] text-white shadow-[0_16px_36px_rgba(24,27,35,0.18)]"
    >
      {/* 여행지 배경 사진 */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-300"
        style={{
          backgroundImage: `url("${current.image}")`,
        }}
      />

      {/* 사진 위 어두운 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(15,17,22,0.16)] to-[rgba(15,17,22,0.78)]" />

      {/* 상단 라벨과 슬라이드 번호 */}
      <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
        <span className="rounded-full border border-white/50 bg-black/20 px-3 py-2 text-xs backdrop-blur-sm">
          Travel Inspiration
        </span>

        <span className="text-xs tracking-widest">
          {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(destinations.length).padStart(2, "0")}
        </span>
      </div>

      {/* 여행지 정보 */}
      <div className="absolute bottom-[92px] left-5 right-5">
        <p className="text-xs tracking-[0.12em]">
          {current.city}
        </p>

        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          {current.title}
        </h2>

        <p className="mt-2 max-w-[330px] text-sm leading-[21px] text-white/75">
          {current.description}
        </p>
      </div>

      {/* 하단 페이지 표시와 이동 버튼 */}
      <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {destinations.map((destination, index) => (
            <button
              key={destination.city}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${destination.title} 슬라이드로 이동`}
              aria-current={
                activeIndex === index ? "true" : undefined
              }
              className={`h-[3px] rounded-full transition-all ${
                activeIndex === index
                  ? "w-[31px] bg-white"
                  : "w-[18px] bg-white/35"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            aria-label="이전 여행지"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/50 bg-black/20 backdrop-blur-sm"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => moveSlide(1)}
            aria-label="다음 여행지"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/50 bg-black/20 backdrop-blur-sm"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
