
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type VoteOption = "must_go" | "would_like" | "neutral" | "skip";

type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  is_confirmed: boolean;
};

type Vote = {
  id: string;
  place_id: string;
  participant_id: string;
  preference: VoteOption;
};

type Props = {
  tripId: string;
  participantId: string;
};

const options: { value: VoteOption; label: string }[] = [
  { value: "must_go", label: "꼭 가고 싶어요" },
  { value: "would_like", label: "가면 좋아요" },
  { value: "neutral", label: "상관없어요" },
  { value: "skip", label: "이번에는 빼고 싶어요" },
];

type ResultCategory =
  | "recommended"
  | "discussion"
  | "low_priority"
  | "needs_vote";

function getResultCategory(
  placeId: string,
  votes: Vote[],
  participantCount: number
): ResultCategory {
  const placeVotes = votes.filter(
    (vote) => vote.place_id === placeId
  );

  if (
    participantCount > 0 &&
    placeVotes.length < participantCount
  ) {
    return "needs_vote";
  }

  const mustGo = placeVotes.filter(
    (vote) => vote.preference === "must_go"
  ).length;

  const wouldLike = placeVotes.filter(
    (vote) => vote.preference === "would_like"
  ).length;

  const skip = placeVotes.filter(
    (vote) => vote.preference === "skip"
  ).length;

  const positive = mustGo + wouldLike;

  if (placeVotes.length === 0) {
    return "needs_vote";
  }

  if (positive > 0 && skip > 0) {
    return "discussion";
  }

  if (skip >= positive && skip > 0) {
    return "low_priority";
  }

  if (positive > 0) {
    return "recommended";
  }

  return "low_priority";
}

export default function VotePage({ tripId, participantId }: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      const [placesResult, votesResult, peopleResult] =
        await Promise.all([
          supabase
            .from("places")
            .select("id, name, category, address, is_confirmed")
            .eq("trip_id", tripId)
            .order("created_at", { ascending: true }),

          supabase
            .from("votes")
            .select("id, place_id, participant_id, preference")
            .eq("trip_id", tripId),

          supabase
            .from("participants")
            .select("id")
            .eq("trip_id", tripId),
        ]);

      if (!active) return;

      if (
        placesResult.error ||
        votesResult.error ||
        peopleResult.error
      ) {
        setErrorMessage("투표 정보를 불러오지 못했습니다.");
      } else {
        setPlaces((placesResult.data ?? []) as Place[]);
        setVotes((votesResult.data ?? []) as Vote[]);
        setParticipantCount(peopleResult.data?.length ?? 0);
        setErrorMessage("");
      }

      setLoading(false);
    }

    void loadData();

    const channel = supabase
      .channel(`vote-page-${tripId}`)
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
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);

  async function handleVote(placeId: string, preference: VoteOption) {
    if (savingId) return;

    const existing = votes.find(
      (vote) =>
        vote.place_id === placeId &&
        vote.participant_id === participantId
    );

    setSavingId(placeId);
    setErrorMessage("");

    try {
      if (existing?.preference === preference) {
        // 같은 선호도를 누르면 투표 취소
        const { error } = await supabase
          .from("votes")
          .delete()
          .eq("id", existing.id)
          .eq("participant_id", participantId);

        if (error) throw error;

        setVotes((previous) =>
          previous.filter((vote) => vote.id !== existing.id)
        );
      } else {
        // 새 투표 또는 기존 투표 변경
        const { data, error } = await supabase
          .from("votes")
          .upsert(
            {
              trip_id: tripId,
              place_id: placeId,
              participant_id: participantId,
              preference,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "place_id,participant_id" }
          )
          .select("id, place_id, participant_id, preference")
          .single();

        if (error) throw error;

        setVotes((previous) => [
          ...previous.filter(
            (vote) =>
              !(
                vote.place_id === placeId &&
                vote.participant_id === participantId
              )
          ),
          data as Vote,
        ]);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("투표를 저장하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  }
    const categoryCounts: Record<ResultCategory, number> = {
    recommended: 0,
    discussion: 0,
    low_priority: 0,
    needs_vote: 0,
    };

    places.forEach((place) => {
    const category = getResultCategory(
        place.id,
        votes,
        participantCount
    );

    categoryCounts[category] += 1;
    });

  const myVotedCount = places.filter((place) =>
    votes.some(
      (vote) =>
        vote.place_id === place.id &&
        vote.participant_id === participantId
    )
  ).length;

  return (
    <section className="mx-auto w-full max-w-md space-y-5 px-5 pb-8 pt-6">
      <p className="text-[15px] leading-6 text-[#74777F]">
        Share preferences and find places everyone can agree on.
      </p>
      
        {/* 그룹 선호도 요약 */}
        <div>
        <p className="text-xs font-medium tracking-[1.5px] text-[#4F51E2]">
            VOTING SUMMARY
        </p>

        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#17181B]">
            Group Preferences
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-2">
            {[
            {
                key: "recommended",
                label: "Want to Go",
                bg: "bg-[#E7F5EC]",
                color: "text-[#25764E]",
            },
            {
                key: "discussion",
                label: "Needs Discussion",
                bg: "bg-[#FFF5D7]",
                color: "text-[#9B6815]",
            },
            {
                key: "low_priority",
                label: "Low Priority",
                bg: "bg-[#FDEBEA]",
                color: "text-[#B1514C]",
            },
            {
                key: "needs_vote",
                label: "Needs Votes",
                bg: "bg-[#EEF0F3]",
                color: "text-[#656976]",
            },
            ].map((item) => (
            <div
                key={item.key}
                className={`rounded-2xl p-4 ${item.bg}`}
            >
                <p className={`text-xs font-medium ${item.color}`}>
                {item.label}
                </p>

                <p className={`mt-2 text-2xl font-semibold ${item.color}`}>
                {categoryCounts[item.key as ResultCategory]}
                </p>
            </div>
            ))}
        </div>
        </div>

      <div className="rounded-2xl border border-[#E2E4E8] bg-white p-5">
        <p className="text-xs tracking-wider text-[#4F51E2]">
          MY VOTING PROGRESS
        </p>
        <div className="mt-2 flex items-end justify-between">
          <h2 className="text-lg font-semibold text-[#17181B]">
            My Preferences
          </h2>
          <span className="text-sm font-semibold text-[#6264F6]">
            {myVotedCount} / {places.length}
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEEEFF]">
          <div
            className="h-full rounded-full bg-[#6264F6]"
            style={{
              width: `${
                places.length
                  ? (myVotedCount / places.length) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[#74777F]">
          투표 정보를 불러오는 중...
        </p>
      ) : places.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500">
          아직 등록된 장소가 없어요. Places에서 장소를 추가해주세요.
        </div>
      ) : (
        <div className="space-y-3">
          {places.map((place) => {
            const myVote = votes.find(
              (vote) =>
                vote.place_id === place.id &&
                vote.participant_id === participantId
            );

            const count = votes.filter(
              (vote) => vote.place_id === place.id
            ).length;

            return (
              <article
                key={place.id}
                className="rounded-2xl border border-[#E2E4E8] bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-[#74777F]">
                      {place.category || "PLACE"}
                    </p>
                    <h3 className="mt-2 break-words text-base font-semibold text-[#17181B]">
                      {place.name}
                    </h3>
                    <p className="mt-2 text-sm text-[#74777F]">
                      {place.address}
                    </p>
                  </div>

                  {place.is_confirmed && (
                    <span className="shrink-0 rounded-full bg-[#E7F5EC] px-2 py-1 text-xs text-[#25764E]">
                      Confirmed
                    </span>
                  )}
                </div>

                <p className="mt-4 text-xs text-[#74777F]">
                  {count} / {participantCount}명 투표 완료
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {options.map((option) => {
                    const selected =
                      myVote?.preference === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={savingId !== null}
                        aria-pressed={selected}
                        onClick={() =>
                          void handleVote(place.id, option.value)
                        }
                        className={`min-h-14 rounded-xl border px-2 py-3 text-xs font-medium transition-colors disabled:opacity-50 ${
                          selected
                            ? "border-[#6264F6] bg-[#EEEEFF] text-[#4F51E2]"
                            : "border-[#E2E4E8] bg-[#F7F7F5] text-[#74777F]"
                        }`}
                      >
                        {option.label}
                        {selected && " ✓"}
                      </button>
                    );
                  })}
                </div>

                {myVote && (
                  <p className="mt-3 text-center text-xs text-[#74777F]">
                    선택한 항목을 다시 누르면 투표가 취소됩니다.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
