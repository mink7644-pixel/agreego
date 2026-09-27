"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import GoogleMap from "./GoogleMap";
import SupabaseStatus from "./SupabaseStatus";
import { supabase } from "../lib/supabase";

type TripProfile = {
  tripId: string;
  tripName: string;
  inviteCode: string;
  participantId: string;
  participantToken: string;
  nickname: string;
};

type TripRow = {
  id: string;
  name: string;
  invite_code: string;
};

type ParticipantRow = {
  id: string;
  nickname: string;
  participant_token: string;
};

type ParticipantEntryRow = {
  participant_id: string;
  participant_nickname: string;
  participant_token: string;
  is_new_participant: boolean;
};

const PROFILE_STORAGE_KEY =
  "trip-consensus-profile";

function createInviteCode() {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let index = 0; index < 8; index += 1) {
    const randomIndex = Math.floor(
      Math.random() * characters.length,
    );

    code += characters[randomIndex];
  }

  return code;
}

export default function TripApp() {
  const [tripName, setTripName] = useState("");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");

  const [profile, setProfile] =
    useState<TripProfile | null>(null);

  const [roomCode, setRoomCode] =
    useState<string | null>(null);

  const [hasLoadedProfile, setHasLoadedProfile] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [formError, setFormError] = 
    useState("");

  const [copyMessage, setCopyMessage] =
    useState("");

  /*
   * URL의 초대 코드와 저장된 참여 정보를 불러오기
   */
  useEffect(() => {
    const searchParams = new URLSearchParams(
      window.location.search,
    );

    const roomFromUrl =
      searchParams.get("room")?.trim() ?? "";

    if (roomFromUrl) {
      setRoomCode(roomFromUrl.toUpperCase());
    }

    try {
      const savedProfile =
        window.localStorage.getItem(
          PROFILE_STORAGE_KEY,
        );

      if (!savedProfile) {
        return;
      }

      const parsedProfile =
        JSON.parse(
          savedProfile,
        ) as Partial<TripProfile>;

      const isValidProfile =
        typeof parsedProfile.tripId === "string" &&
        typeof parsedProfile.tripName === "string" &&
        typeof parsedProfile.inviteCode ===
          "string" &&
        typeof parsedProfile.participantId ===
          "string" &&
        typeof parsedProfile.participantToken ===
          "string" &&
        typeof parsedProfile.nickname === "string";

      if (!isValidProfile) {
        /*
         * 이전 단계에서 저장한 옛 형식의 데이터는 삭제
         */
        window.localStorage.removeItem(
          PROFILE_STORAGE_KEY,
        );

        return;
      }

      /*
       * 다른 여행방 초대 링크로 들어왔다면
       * 기존 프로필을 자동 적용하지 않음
       */
      if (
        roomFromUrl &&
        parsedProfile.inviteCode !==
          roomFromUrl.toUpperCase()
      ) {
        return;
      }

      setProfile({
        tripId: parsedProfile.tripId!,
        tripName: parsedProfile.tripName!,
        inviteCode: parsedProfile.inviteCode!,
        participantId:
          parsedProfile.participantId!,
        participantToken:
          parsedProfile.participantToken!,
        nickname: parsedProfile.nickname!,
      });
    } catch (error) {
      console.error(
        "저장된 여행방 정보를 불러오지 못했습니다.",
        error,
      );

      window.localStorage.removeItem(
        PROFILE_STORAGE_KEY,
      );
    } finally {
      setHasLoadedProfile(true);
    }
  }, []);

  function saveProfile(nextProfile: TripProfile) {
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify(nextProfile),
    );

    setProfile(nextProfile);
  }

  async function enterParticipantWithPin(
    trip: TripRow,
    trimmedNickname: string,
    trimmedPin: string,
  ) {
    const { data, error } = await supabase.rpc(
      "enter_participant_with_pin",
      {
        p_trip_id: trip.id,
        p_nickname: trimmedNickname,
        p_pin: trimmedPin,
      },
    );

    if (error) {
      console.error(error);

      const message = error.message ?? "";

      if (
        message.includes(
          "PIN이 올바르지 않습니다.",
        )
      ) {
        throw new Error(
          "PIN이 올바르지 않습니다.",
        );
      }

      if (
        message.includes(
          "숫자 4자리여야 합니다.",
        )
      ) {
        throw new Error(
          "PIN은 숫자 4자리로 입력해주세요.",
        );
      }

      throw new Error(
        "PIN이 올바르지 않습니다.",
      );
    }

    const participantEntry = (
      data as ParticipantEntryRow[] | null
    )?.[0];

    if (!participantEntry) {
      throw new Error(
        "참여자 정보를 불러오지 못했습니다.",
      );
    }

    saveProfile({
      tripId: trip.id,
      tripName: trip.name,
      inviteCode: trip.invite_code,
      participantId:
        participantEntry.participant_id,
      participantToken:
        participantEntry.participant_token,
      nickname:
        participantEntry.participant_nickname,
    });
  }

  /*
   * 새 여행방 만들기
   */
  async function createTrip(
    trimmedTripName: string,
    trimmedNickname: string,
    trimmedPin: string,
  ) {
    let createdTrip: TripRow | null = null;

    /*
     * 초대 코드가 우연히 중복되는 경우를 대비해
     * 최대 세 번 새 코드를 만들어 재시도
     */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const inviteCode = createInviteCode();

      const { data, error } = await supabase
        .from("trips")
        .insert({
          name: trimmedTripName,
          invite_code: inviteCode,
        })
        .select("id, name, invite_code")
        .single();

      if (!error) {
        createdTrip = data as TripRow;
        break;
      }

      /*
       * PostgreSQL unique violation
       */
      if (error.code !== "23505") {
        throw error;
      }
    }

    if (!createdTrip) {
      throw new Error(
        "초대 코드를 만들지 못했습니다.",
      );
    }

    try {
      await enterParticipantWithPin(
        createdTrip,
        trimmedNickname,
        trimmedPin,
      );
    } catch (error) {
      /*
      * 참여자 생성에 실패한 빈 여행방 제거
      */
      await supabase
        .from("trips")
        .delete()
        .eq("id", createdTrip.id);

      throw error;
    }

    const nextUrl =
      `${window.location.pathname}` +
      `?room=${createdTrip.invite_code}`;

    window.history.replaceState(
      {},
      "",
      nextUrl,
    );

    setRoomCode(createdTrip.invite_code);
  }

  /*
   * 초대 코드로 기존 여행방 참여
   */
  async function joinTrip(
    inviteCode: string,
    trimmedNickname: string,
    trimmedPin: string,
  ) {
    const { data: tripData, error: tripError } =
      await supabase
        .from("trips")
        .select("id, name, invite_code")
        .eq("invite_code", inviteCode)
        .maybeSingle();

    if (tripError) {
      throw tripError;
    }

    if (!tripData) {
      throw new Error(
        "존재하지 않거나 삭제된 여행방입니다.",
      );
    }

    const trip = tripData as TripRow;

    await enterParticipantWithPin(
      trip,
      trimmedNickname,
      trimmedPin,
    );
  }

  async function handleEnterTrip(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedTripName = tripName.trim();
    const trimmedNickname = nickname.trim();
    const trimmedPin = pin.trim();

    if (!trimmedNickname) {
      setFormError("닉네임을 입력해주세요.");
      return;
    }

    if (trimmedNickname.length > 12) {
      setFormError(
        "닉네임은 12자 이내로 입력해주세요.",
      );
      return;
    }

    if (!/^\d{4}$/.test(trimmedPin)) {
      setFormError(
        "PIN은 숫자 4자리로 입력해주세요.",
      );
      return;
    }

    if (!roomCode && !trimmedTripName) {
      setFormError(
        "여행방 이름을 입력해주세요.",
      );
      return;
    }

    if (
      !roomCode &&
      trimmedTripName.length > 30
    ) {
      setFormError(
        "여행방 이름은 30자 이내로 입력해주세요.",
      );
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      if (roomCode) {
        await joinTrip(
          roomCode,
          trimmedNickname,
          trimmedPin,
        );
      } else {
        await createTrip(
          trimmedTripName,
          trimmedNickname,
          trimmedPin,
        );
      }
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError(
          "여행방 처리 중 오류가 발생했습니다.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLeaveTrip() {
    const shouldLeave = window.confirm(
      "이 여행방에서 나갈까요?",
    );

    if (!shouldLeave) {
      return;
    }

    window.localStorage.removeItem(
      PROFILE_STORAGE_KEY,
    );

    setProfile(null);
    setTripName("");
    setNickname("");
    setPin("");
    setFormError("");
    setCopyMessage("");
  }

  async function handleCopyInviteLink() {
    if (!profile) {
      return;
    }

    const inviteLink =
      `${window.location.origin}` +
      `${window.location.pathname}` +
      `?room=${profile.inviteCode}`;

    try {
      await navigator.clipboard.writeText(
        inviteLink,
      );

      setCopyMessage(
        "초대 링크를 복사했습니다.",
      );

      window.setTimeout(() => {
        setCopyMessage("");
      }, 2000);
    } catch (error) {
      console.error(error);

      window.prompt(
        "아래 링크를 복사해주세요.",
        inviteLink,
      );
    }
  }

  if (!hasLoadedProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-5">
        <p className="text-sm text-gray-500">
          여행방 정보를 불러오는 중입니다...
        </p>
      </main>
    );
  }

  /*
   * 아직 여행방에 참여하지 않은 경우
   */
  if (!profile) {
    const isJoiningRoom = Boolean(roomCode);

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-5 py-10">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-sm">
          <div>
            <p className="text-sm font-bold text-blue-600">
              여행 장소 합의 서비스
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              {isJoiningRoom ? (
                <>
                  초대받은 여행방에
                  <br />
                  참여해보세요
                </>
              ) : (
                <>
                  친구들과 갈 곳을
                  <br />
                  함께 정해보세요
                </>
              )}
            </h1>

            <p className="mt-4 text-sm text-gray-600">
              닉네임과 개인 입장 번호를 입력해 여행방에 참여해주세요.
            </p>
          </div>

          <form
            onSubmit={handleEnterTrip}
            className="mt-8 space-y-5"
          >
            {!isJoiningRoom && (
              <div>
                <label
                  htmlFor="trip-name"
                  className="text-sm font-semibold text-gray-800"
                >
                  여행방 이름
                </label>

                <input
                  id="trip-name"
                  type="text"
                  value={tripName}
                  onChange={(event) => {
                    setTripName(
                      event.target.value,
                    );
                    setFormError("");
                  }}
                  placeholder="예: 서울 당일치기"
                  maxLength={30}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-1 text-right text-xs text-gray-400">
                  {tripName.length} / 30
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="nickname"
                className="text-sm font-semibold text-gray-800"
              >
                내 닉네임
              </label>

              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(event) => {
                  setNickname(
                    event.target.value,
                  );
                  setFormError("");
                }}
                placeholder="예: 민경"
                maxLength={12}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-1 text-right text-xs text-gray-400">
                {nickname.length} / 12
              </p>
            </div>

            <div>
              <label
                htmlFor="participant-pin"
                className="text-sm font-semibold text-gray-800"
              >
                개인 입장 번호
              </label>

              <input
                id="participant-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => {
                  const onlyNumbers =
                    event.target.value.replace(
                      /\D/g,
                      "",
                    );

                  setPin(onlyNumbers.slice(0, 4));
                  setFormError("");
                }}
                placeholder="숫자 4자리"
                maxLength={4}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm tracking-[0.4em] text-gray-900 outline-none placeholder:tracking-normal placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs leading-5 text-gray-500">
                여행방에 다시 들어올 때 필요해요.
                기억할 수 있는 숫자 4자리를 입력해주세요.
              </p>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmitting
                ? "처리 중..."
                : isJoiningRoom
                  ? "여행방 참여"
                  : "여행방 만들기"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const inviteLink =
    `${typeof window !== "undefined"
      ? window.location.origin
      : ""}` +
    `/?room=${profile.inviteCode}`;

  return (
    <main className="min-h-screen bg-gray-100 px-5 py-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-600">
                여행 장소 합의 서비스
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
                {profile.tripName}
              </h1>

              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-800">
                  {profile.nickname}
                </span>
                님으로 참여 중입니다.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLeaveTrip}
              className="self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              여행방 나가기
            </button>
          </div>

          <div className="mt-5 rounded-xl bg-gray-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500">
                  친구 초대 링크
                </p>

                <p className="mt-1 truncate text-sm text-gray-700">
                  {inviteLink}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="shrink-0 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
              >
                링크 복사
              </button>
            </div>

            {copyMessage && (
              <p className="mt-2 text-xs font-medium text-blue-600">
                {copyMessage}
              </p>
            )}
          </div>
        </header>

        <SupabaseStatus />

        <GoogleMap
          tripId={profile.tripId}
          participantId={profile.participantId}
        />
      </div>
    </main>
  );
}