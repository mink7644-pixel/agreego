
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  tripId: string;
};

type Participant = {
  id: string;
  nickname: string;
};

type Stats = {
  participants: number;
  places: number;
  votes: number;
  confirmed: number;
};

export default function HomeTripStats({ tripId }: Props) {
  const [stats, setStats] = useState<Stats>({
    participants: 0,
    places: 0,
    votes: 0,
    confirmed: 0,
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadStats() {
      const [peopleResult, placesResult, votesResult] =
        await Promise.all([
          supabase
            .from("participants")
            .select("id, nickname")
            .eq("trip_id", tripId)
            .order("created_at", { ascending: true }),

          supabase
            .from("places")
            .select("id, is_confirmed")
            .eq("trip_id", tripId),

          supabase
            .from("votes")
            .select("place_id, participant_id")
            .eq("trip_id", tripId),
        ]);

      if (!active) return;

      if (
        peopleResult.error ||
        placesResult.error ||
        votesResult.error
      ) {
        setErrorMessage("여행 현황을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      const people = peopleResult.data ?? [];
      setParticipants(people as Participant[]);
      const places = placesResult.data ?? [];
      const votes = votesResult.data ?? [];

      const participantIds = new Set(people.map((p) => p.id));
      const placeIds = new Set(places.map((p) => p.id));

      const validVotes = votes.filter(
        (vote) =>
          participantIds.has(vote.participant_id) &&
          placeIds.has(vote.place_id)
      );

      setStats({
        participants: people.length,
        places: places.length,
        votes: validVotes.length,
        confirmed: places.filter((p) => p.is_confirmed).length,
      });

      setErrorMessage("");
      setLoading(false);
    }

    void loadStats();

    const channel = supabase
      .channel(`home-stats-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void loadStats()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void loadStats()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void loadStats()
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);

  const totalVotes = stats.participants * stats.places;

  const progress =
    totalVotes === 0
      ? 0
      : Math.min(
          100,
          Math.round((stats.votes / totalVotes) * 100)
        );

  if (loading) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        여행 현황을 불러오는 중...
      </p>
    );
  }

  if (errorMessage) {
    return (
      <p role="alert" className="mt-4 text-sm text-red-600">
        {errorMessage}
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-[#E2E4E8] pt-4">
      {/* 참여자 정보 */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#74777F]">
          Planning together with {participants.length} friends.
        </p>

        <div className="flex shrink-0 -space-x-2">
          {participants.slice(0, 4).map((person, index) => {
            const colors = [
              "bg-[#C6C2FF]",
              "bg-[#FFB5A4]",
              "bg-[#F3D67C]",
              "bg-[#A8D1E8]",
            ];

            return (
              <div
                key={person.id}
                title={person.nickname}
                className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white text-xs font-medium text-[#4F51E2] ${
                  colors[index % colors.length]
                }`}
              >
                {person.nickname.slice(0, 1)}
              </div>
            );
          })}

          {participants.length > 4 && (
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-[#EEF0F3] text-[10px] font-medium text-[#74777F]">
              +{participants.length - 4}
            </div>
          )}
        </div>
      </div>

      {/* 여행 투표 진행률 */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#17181B]">
            Trip Progress
          </span>
          <span className="text-sm font-semibold text-[#6264F6]">
            {progress}%
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9E9FF]">
          <div
            className="h-full rounded-full bg-[#6264F6] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-[#74777F]">
          {stats.votes} of {totalVotes} preferences submitted
        </p>
      </div>
    </div>
  );

}
