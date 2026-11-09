
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Participant = {
  id: string;
  nickname: string;
};

type TripPageProps = {
  tripId: string;
  tripName: string;
  nickname: string;
  participantId: string;
  inviteLink: string;
  onCopyInviteLink: () => void;
  copyMessage: string;
};

const avatarColors = [
  "bg-[#C6C2FF]",
  "bg-[#FFB5A4]",
  "bg-[#F3D67C]",
  "bg-[#A8D1E8]",
];

export default function TripPage({
  tripId,
  tripName,
  nickname,
  participantId,
  inviteLink,
  onCopyInviteLink,
  copyMessage,
}: TripPageProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [placeCount, setPlaceCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadParticipants() {
      const { data, error } = await supabase
        .from("participants")
        .select("id, nickname")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setErrorMessage("참여자 정보를 불러오지 못했습니다.");
      } else {
        setParticipants((data ?? []) as Participant[]);
        setErrorMessage("");
      }

      setLoading(false);
    }

    void loadParticipants();

    const channel = supabase
      .channel(`trip-page-participants-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          void loadParticipants();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);
  
    useEffect(() => {
    let active = true;

    async function loadTripStats() {
        const [placesResult, votesResult] = await Promise.all([
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

        if (placesResult.error || votesResult.error) {
        setStatsError(true);
        setStatsLoading(false);
        return;
        }

        const places = placesResult.data ?? [];
        const votes = votesResult.data ?? [];

        setPlaceCount(places.length);
        setConfirmedCount(
        places.filter((place) => place.is_confirmed).length
        );

        const placeIds = new Set(places.map((place) => place.id));
        const participantIds = new Set(
        participants.map((person) => person.id)
        );

        const completedVotes = votes.filter(
        (vote) =>
            placeIds.has(vote.place_id) &&
            participantIds.has(vote.participant_id)
        );

        setVoteCount(completedVotes.length);
        setStatsError(false);
        setStatsLoading(false);
    }

    void loadTripStats();

    const channel = supabase
        .channel(`trip-stats-${tripId}`)
        .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "places",
            filter: `trip_id=eq.${tripId}`,
        },
        () => void loadTripStats()
        )
        .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "votes",
            filter: `trip_id=eq.${tripId}`,
        },
        () => void loadTripStats()
        )
        .subscribe();

    return () => {
        active = false;
        void supabase.removeChannel(channel);
    };
    }, [tripId, participants]);

    const totalPossibleVotes = placeCount * participants.length;

    const progress =
    totalPossibleVotes === 0
        ? 0
        : Math.min(
            100,
            Math.round((voteCount / totalPossibleVotes) * 100)
        );


  const cardStyle =
    "rounded-2xl border border-[#E2E4E8] bg-white p-5 shadow-sm";

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-6 pt-6 text-[#17181B]">
      <p className="text-[15px] text-[#74777F]">
        Manage invites, travelers, and trip progress.
      </p>

      {/* 현재 여행방 */}
      <article className={cardStyle}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEEEFF] text-xl text-[#6264F6]">
            ✈
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-wider text-[#74777F]">
              Current Trip
            </p>
            <h2 className="mt-1 break-words text-base font-semibold">
              {tripName}
            </h2>
            <p className="mt-1 text-sm text-[#74777F]">
              {nickname}님으로 참여 중
            </p>
          </div>

          <div className="flex shrink-0 -space-x-2">
            {participants.slice(0, 4).map((person, index) => (
              <div
                key={person.id}
                title={person.nickname}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ${
                  avatarColors[index % avatarColors.length]
                }`}
              >
                {person.nickname.slice(0, 1)}
              </div>
            ))}
          </div>
        </div>
      </article>

      {/* 친구 초대 */}
      <article className={cardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wider text-[#74777F]">
              CARD 02
            </p>
            <h2 className="mt-2 text-base font-semibold">
              Invite Friends
            </h2>
          </div>
          <span className="text-xl text-[#6264F6]">↗</span>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-[#74777F]">
          Share this link so friends can join without signing up.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E2E4E8] bg-[#F7F7F5] p-2">
          <p className="min-w-0 flex-1 truncate pl-1 text-sm text-[#74777F]">
            {inviteLink}
          </p>

          <button
            type="button"
            onClick={onCopyInviteLink}
            className="min-h-11 shrink-0 rounded-lg bg-[#6264F6] px-3 text-xs font-semibold text-white"
          >
            Copy Link
          </button>
        </div>

        {copyMessage && (
          <p className="mt-2 text-xs text-[#6264F6]">
            {copyMessage}
          </p>
        )}
      </article>

      {/* 참여자 목록 */}
      <article className={cardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wider text-[#74777F]">
              CARD 03
            </p>
            <h2 className="mt-2 text-base font-semibold">
              Travelers
            </h2>
          </div>

          <button
            type="button"
            onClick={onCopyInviteLink}
            className="min-h-11 px-2 text-xs font-medium text-[#4F51E2]"
          >
            Invite ↗
          </button>
        </div>

        <div className="mt-3 border-t border-[#E2E4E8]">
          {loading ? (
            <p className="py-5 text-sm text-gray-500">
              참여자 정보를 불러오는 중...
            </p>
          ) : errorMessage ? (
            <p className="py-5 text-sm text-red-500">
              {errorMessage}
            </p>
          ) : (
            participants.map((person, index) => (
              <div
                key={person.id}
                className="flex min-h-[65px] items-center gap-3 border-b border-[#E2E4E8] py-3"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    avatarColors[index % avatarColors.length]
                  }`}
                >
                  {person.nickname.slice(0, 1)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {person.nickname}
                  </p>
                  <p className="mt-1 text-xs text-[#74777F]">
                    {person.id === participantId
                      ? "You"
                      : "Traveler"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && !errorMessage && (
          <p className="mt-3 text-xs text-[#74777F]">
            총 {participants.length}명 참여 중
          </p>
        )}
      </article>

    {/* 여행 진행 현황 */}
    <article className={cardStyle}>
    <p className="text-xs tracking-wider text-[#74777F]">
        CARD 04
    </p>

    <h2 className="mt-2 text-base font-semibold">
        Trip Progress
    </h2>

    {statsError ? (
        <p className="mt-4 text-sm text-red-500">
        진행 현황을 불러오지 못했습니다.
        </p>
    ) : statsLoading ? (
        <p className="mt-4 text-sm text-[#74777F]">
        진행 현황을 불러오는 중...
        </p>
    ) : (
        <>
        <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-[#74777F]">
            Voting Progress
            </span>

            <span className="text-sm font-semibold text-[#6264F6]">
            {progress}%
            </span>
        </div>

        <div
            role="progressbar"
            aria-label="투표 진행률"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEEEFF]"
        >
            <div
            className="h-full rounded-full bg-[#6264F6] transition-all duration-300"
            style={{ width: `${progress}%` }}
            />
        </div>

        <p className="mt-2 text-xs text-[#74777F]">
            {voteCount} / {totalPossibleVotes} votes completed
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
            {[
            { label: "Places", value: placeCount },
            { label: "Votes", value: voteCount },
            { label: "Confirmed", value: confirmedCount },
            ].map((stat) => (
            <div
                key={stat.label}
                className="rounded-xl bg-[#F7F7F5] p-3 text-center"
            >
                <p className="text-xl font-semibold text-[#17181B]">
                {stat.value}
                </p>

                <p className="mt-1 text-xs text-[#74777F]">
                {stat.label}
                </p>
            </div>
            ))}
        </div>
        </>
    )}
    </article>

    </section>
  );
}
