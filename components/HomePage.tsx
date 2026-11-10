import HomeTripStats from "./HomeTripStats";
import HomeDestinationSlider from "./HomeDestinationSlider";
import { Map, Check } from "lucide-react";

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
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-6">
      <HomeDestinationSlider />

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

      {/* Quick Actions */}
      <section className="rounded-2xl border border-[#E2E4E8] bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#6264F6]">
            QUICK ACTIONS
          </p>
          <h2 className="mt-2 text-base font-semibold text-[#17181B]">
            What would you like to do?
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate("map")}
            className="flex min-h-[116px] flex-col items-start justify-between rounded-xl border border-[#E2E4E8] bg-[#F7F7F5] p-4 text-left transition-colors hover:bg-[#EEF0FF]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E9E9FF] text-[#6264F6]">
              <Map size={20} strokeWidth={1.8} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#17181B]">
                Explore Map
              </p>
              <p className="mt-1 text-xs text-[#74777F]">
                View places
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("vote")}
            className="flex min-h-[116px] flex-col items-start justify-between rounded-xl border border-[#E2E4E8] bg-[#F7F7F5] p-4 text-left transition-colors hover:bg-[#EEF0FF]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E9E9FF] text-[#6264F6]">
              <Check size={20} strokeWidth={1.8} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#17181B]">
                Continue Voting
              </p>
              <p className="mt-1 text-xs text-[#74777F]">
                Share preferences
              </p>
            </div>
          </button>
        </div>
      </section>

    </section>
  );
}
