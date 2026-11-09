
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  recommendation_reason: string | null;
  added_by: string | null;
  is_confirmed: boolean;
};

type Participant = {
  id: string;
  nickname: string;
};

type Vote = {
  id: string;
  place_id: string;
  participant_id: string;
  preference: "must_go" | "would_like" | "neutral" | "skip";
};

const voteLabels: Record<Vote["preference"], string> = {
  must_go: "꼭 가고 싶어요",
  would_like: "가면 좋아요",
  neutral: "상관없어요",
  skip: "이번에는 빼고 싶어요",
};

type PlacesPageProps = {
  tripId: string;
  participantId: string;
  onAddPlace: () => void;
};

export default function PlacesPage({
  tripId,
  participantId,
  onAddPlace,
}: PlacesPageProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [votes, setVotes] = useState<Vote[]>([]);
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
    const [placesResult, participantsResult, votesResult] =
    await Promise.all([
        supabase
        .from("places")
        .select(
            "id, name, category, address, recommendation_reason, added_by, is_confirmed"
        )
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true }),

        supabase
        .from("participants")
        .select("id, nickname")
        .eq("trip_id", tripId),

        supabase
        .from("votes")
        .select("id, place_id, participant_id, preference")
        .eq("trip_id", tripId),
    ]);


      if (!active) return;

      if (
        placesResult.error ||
        participantsResult.error ||
        votesResult.error
        ) {
        setErrorMessage("장소 정보를 불러오지 못했습니다.");
      } else {
        setPlaces((placesResult.data ?? []) as Place[]);
        setParticipants(
          (participantsResult.data ?? []) as Participant[]
        );
        setVotes((votesResult.data ?? []) as Vote[]);
        setErrorMessage("");
      }

      setLoading(false);
    }

    void loadData();

    const channel = supabase
      .channel(`places-page-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void loadData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void loadData()
      )
      .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "votes",
            filter: `trip_id=eq.${tripId}`,
        },
        () => void loadData()
        )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);

  function getRecommender(id: string | null) {
    if (!id) return null;

    return (
      participants.find((person) => person.id === id)?.nickname ??
      null
    );
  }

  return (
    <section className="mx-auto w-full max-w-md space-y-4 px-5 pb-8 pt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-[220px] text-[15px] leading-6 text-[#74777F]">
          Review places and recommendations from your group.
        </p>

        <button
          type="button"
          onClick={onAddPlace}
          className="min-h-11 shrink-0 rounded-[10px] border border-[#CED1D7] bg-white px-3 text-xs font-semibold text-[#17181B] shadow-sm"
        >
          + Add Place
        </button>
      </div>

      <p className="text-sm text-[#74777F]">
        {places.length} places suggested
      </p>

      {loading ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-gray-500">
          장소를 불러오는 중...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-red-600">
          {errorMessage}
        </div>
      ) : places.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E4E8] bg-white p-8 text-center">
          <p className="font-semibold text-[#17181B]">
            아직 등록된 장소가 없어요.
          </p>
          <p className="mt-2 text-sm text-[#74777F]">
            첫 번째 여행 장소를 추천해 보세요!
          </p>
          <button
            type="button"
            onClick={onAddPlace}
            className="mt-5 rounded-xl bg-[#6264F6] px-5 py-3 text-sm font-semibold text-white"
          >
            장소 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {places.map((place) => {
            const recommender = getRecommender(place.added_by);
    
            const placeVotes = votes.filter(
            (vote) => vote.place_id === place.id
            );

            const isExpanded = expandedPlaceId === place.id;

            const voteCount = placeVotes.length;
            const participantCount = participants.length;

            const voteProgress =
            participantCount > 0
                ? Math.min(
                    100,
                    Math.round((voteCount / participantCount) * 100)
                )
                : 0;


            return (
              <article
                key={place.id}
                className="overflow-hidden rounded-2xl border border-[#E2E4E8] bg-white shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[#EEEEFF] text-xl">
                      📍
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-wider text-[#74777F]">
                          {place.category || "PLACE"}
                        </span>

                        {place.is_confirmed && (
                          <span className="rounded-full bg-[#E7F5EC] px-2 py-1 text-xs text-[#25764E]">
                            Confirmed
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 break-words text-base font-semibold text-[#17181B]">
                        {place.name}
                      </h3>

                      <p className="mt-2 break-words text-sm leading-5 text-[#74777F]">
                        {place.address || "주소 정보 없음"}
                      </p>
                    </div>
                  </div>

                  {place.recommendation_reason && (
                    <div className="mt-4 border-t border-[#E2E4E8] pt-4">
                      <p className="text-[15px] leading-6 text-[#303238]">
                        “{place.recommendation_reason}”
                      </p>

                      {recommender && (
                        <p className="mt-1 text-sm text-[#74777F]">
                          Suggested by {recommender}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 투표 현황 펼치기 */}
                <div className="border-t border-[#E2E4E8] bg-[#FBFBFA]">
                <button
                    type="button"
                    onClick={() =>
                    setExpandedPlaceId(isExpanded ? null : place.id)
                    }
                    aria-expanded={isExpanded}
                    className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left"
                >
                    <span className="text-sm text-[#74777F]">
                    {voteCount} / {participantCount}명 투표 완료
                    </span>

                    <span className="text-sm font-medium text-[#6264F6]">
                    {isExpanded ? "접기 ↑" : "투표 현황 보기 ↓"}
                    </span>
                </button>

                {isExpanded && (
                    <div className="border-t border-[#E2E4E8] px-4 pb-5 pt-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#17181B]">
                        Voting Progress
                        </p>
                        <p className="text-sm font-semibold text-[#6264F6]">
                        {voteProgress}%
                        </p>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEEEFF]">
                        <div
                        className="h-full rounded-full bg-[#6264F6]"
                        style={{ width: `${voteProgress}%` }}
                        />
                    </div>

                    <div className="mt-5 space-y-3">
                        {(
                        [
                            "must_go",
                            "would_like",
                            "neutral",
                            "skip",
                        ] as const
                        ).map((preference) => {
                        const count = placeVotes.filter(
                            (vote) => vote.preference === preference
                        ).length;

                        return (
                            <div
                            key={preference}
                            className="flex items-center justify-between text-sm"
                            >
                            <span className="text-[#74777F]">
                                {voteLabels[preference]}
                            </span>

                            <span className="font-semibold text-[#17181B]">
                                {count}명
                            </span>
                            </div>
                        );
                        })}
                    </div>

                    <p className="mt-4 text-xs text-[#74777F]">
                        투표는 Vote 화면에서 진행할 수 있습니다.
                    </p>
                    </div>
                )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
