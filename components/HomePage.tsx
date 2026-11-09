import HomeTripStats from "./HomeTripStats";

type HomePageProps = {
  tripId: string;
  tripName: string;
  nickname: string;
  onNavigate: (tab: "map" | "places" | "vote" | "trip") => void;
};

export default function HomePage({
  tripId,
  tripName,
  nickname,
  onNavigate,
}: HomePageProps) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 pb-6">
      {/* 여행 안내 카드: Figma의 이미지와 문구는 추후 연결 */}
      <article className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[22px] bg-[#17181B] p-5 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-white/40 px-3 py-1.5 text-xs">
            Travel Inspiration
          </span>
          <span className="text-xs">01 / 03</span>
        </div>

        <div>
          <p className="text-xs tracking-widest text-white/75">
            YOUR NEXT ADVENTURE
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Agree first, then go.
          </h2>
          <p className="mt-2 text-sm text-white/75">
            함께 계획하고, 함께 떠나는 여행
          </p>
        </div>
      </article>

      {/* 실제 여행방 정보 */}
      <article className="rounded-[22px] border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold tracking-wider text-[#6264F6]">
          ACTIVE TRIP
        </p>

        <h2 className="mt-2 text-xl font-bold text-[#17181B]">
          {tripName}
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          {nickname}님과 함께하는 여행 계획
        </p>

        <HomeTripStats tripId={tripId} />

        <button
          type="button"
          onClick={() => onNavigate("trip")}
          className="mt-5 w-full rounded-xl bg-[#6264F6] px-4 py-3 text-sm font-semibold text-white"
        >
          여행 정보 확인
        </button>
      </article>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("map")}
          className="rounded-[20px] border border-gray-200 bg-white p-5 text-left"
        >
          <span className="text-2xl">🗺️</span>
          <h3 className="mt-4 font-bold text-[#17181B]">
            Explore Map
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            여행 장소 둘러보기
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("vote")}
          className="rounded-[20px] border border-gray-200 bg-white p-5 text-left"
        >
          <span className="text-2xl">✓</span>
          <h3 className="mt-4 font-bold text-[#17181B]">
            Continue Voting
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            장소 선호도 투표하기
          </p>
        </button>
      </div>
    </section>
  );
}
