"use client";
import TripPage from "./TripPage";
import PlacesPage from "./PlacesPage";
import VotePage from "./VotePage";
import AddPlaceModal from "./AddPlaceModal";
import { Share2, LogOut } from "lucide-react";

import BottomNavigation, {
  type AppTab,
} from "./BottomNavigation";
import HomePage from "./HomePage";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import GoogleMap from "./GoogleMap";

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
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [focusAddPlace, setFocusAddPlace] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
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

    const inputStyle =
      "mt-2 h-[50px] w-full rounded-xl border border-[#CED1D7] bg-[#F7F7F5] px-4 text-base text-[#17181B] outline-none placeholder:text-[#9A9DA5] focus:border-[#6264F6] focus:ring-2 focus:ring-[#6264F6]/15";

    return (
      <main className="min-h-screen bg-[#F7F7F5] px-6 pb-12 pt-12">
        <div className="mx-auto w-full max-w-md">

          {/* AgreeGo 로고 */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#6264F6] text-lg font-bold text-white">
              A
            </div>

            <h1 className="text-[21px] font-bold tracking-tight text-[#17181B]">
              Agree
              <span className="text-[#6264F6]">Go</span>
            </h1>
          </div>

          {/* 메인 슬로건 */}
          <div className="mt-20 mb-9">
            <h2 className="text-[clamp(38px,11vw,48px)] leading-[1.05] font-bold tracking-[-0.065em] text-[#17181B]">
              Agree first,
              <br />
              then go.
            </h2>
          </div>

          {/* 여행방 생성 / 참여 카드 */}
          <div className="rounded-[20px] border border-[#E2E4E8] bg-white/90 p-5 shadow-[0_18px_50px_rgba(24,27,35,0.10)]">

            {/* 카드 상단 */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-[#EEEEFF] px-3 py-1.5 text-xs font-medium text-[#4F51E2]">
                {isJoiningRoom ? "Join Trip" : "New Trip"}
              </span>

              <span className="text-sm font-medium text-[#17181B]">
                {isJoiningRoom
                  ? "Join your friends"
                  : "Just three things to get started"}
              </span>
            </div>

            <form onSubmit={handleEnterTrip} className="space-y-4">

              {/* 여행방 이름: 새 여행방을 만들 때만 표시 */}
              {!isJoiningRoom && (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="trip-name"
                      className="text-sm font-medium text-[#17181B]"
                    >
                      Trip Name
                    </label>

                    <span className="text-xs text-[#74777F]">
                      Up to 30 characters
                    </span>
                  </div>

                  <input
                    id="trip-name"
                    type="text"
                    value={tripName}
                    onChange={(event) => {
                      setTripName(event.target.value);
                      setFormError("");
                    }}
                    placeholder="예: 서울 당일치기"
                    maxLength={30}
                    className={inputStyle}
                  />
                </div>
              )}

              {/* 닉네임 */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="nickname"
                    className="text-sm font-medium text-[#17181B]"
                  >
                    Your Nickname
                  </label>

                  <span className="text-xs text-[#74777F]">
                    Up to 12 characters
                  </span>
                </div>

                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setFormError("");
                  }}
                  placeholder="예: 민경"
                  maxLength={12}
                  className={inputStyle}
                />
              </div>

              {/* 개인 PIN */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="participant-pin"
                    className="text-sm font-medium text-[#17181B]"
                  >
                    Personal PIN
                  </label>

                  <span className="text-xs text-[#74777F]">
                    4 digits
                  </span>
                </div>

                <input
                  id="participant-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(event) => {
                    const onlyNumbers =
                      event.target.value.replace(/\D/g, "");

                    setPin(onlyNumbers.slice(0, 4));
                    setFormError("");
                  }}
                  placeholder="숫자 4자리"
                  maxLength={4}
                  className={`${inputStyle} tracking-[0.3em] placeholder:tracking-normal`}
                />

                <p className="mt-2 text-xs leading-5 text-[#74777F]">
                  Use this PIN to identify yourself when you return.
                </p>
              </div>

              {/* 오류 메시지 */}
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {formError}
                </p>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#6264F6] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#5153DF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? "처리 중..."
                  : isJoiningRoom
                    ? "Join Trip"
                    : "Create Trip"}

                {!isSubmitting && (
                  <span aria-hidden="true" className="text-lg">
                    →
                  </span>
                )}
              </button>
            </form>

            <p className="mt-3 text-center text-xs leading-5 text-[#74777F]">
              Remember your PIN to return to this trip.
            </p>
          </div>
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
    <main className="min-h-screen bg-[#F7F7F5] pb-28">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 border-b border-[#E2E4E8] bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            {/* AgreeGo 브랜드 */}
            {activeTab === "home" ? (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6264F6] text-lg font-bold text-white">
                  A
                </div>

                <h1 className="text-[21px] font-bold tracking-tight text-[#17181B]">
                  Agree<span className="text-[#6264F6]">Go</span>
                </h1>
              </div>
            ) : (
              <h1 className="text-xl font-semibold text-[#17181B]">
                {activeTab === "map"
                  ? "Map"
                  : activeTab === "places"
                    ? "Places"
                    : activeTab === "vote"
                      ? "Vote"
                      : "Trip"}
              </h1>
            )}

            {/* 오른쪽 버튼 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInvite((prev) => !prev)}
                aria-label="친구 초대"
                aria-expanded={showInvite}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#EEEEFF] px-3 text-xs font-semibold text-[#6264F6]"
              >
                <Share2 size={17} strokeWidth={1.8} />
                <span>초대</span>
              </button>

              <button
                type="button"
                onClick={handleLeaveTrip}
                aria-label="여행방 나가기"
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#E2E4E8] bg-white px-3 text-xs font-medium text-[#74777F]"
              >
                <LogOut size={17} strokeWidth={1.8} />
                <span>나가기</span>
              </button>
            </div>
          </div>

          {/* 초대 버튼을 눌렀을 때만 표시 */}
          {showInvite && (
            <div className="mx-auto max-w-5xl border-t border-[#E2E4E8] px-5 py-4">
              <p className="text-sm font-semibold text-[#17181B]">
                친구 초대하기
              </p>

              <p className="mt-2 break-all rounded-xl bg-[#F7F7F5] p-3 text-xs text-gray-600">
                {inviteLink}
              </p>

              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="mt-3 w-full rounded-xl bg-[#6264F6] px-4 py-3 text-sm font-semibold text-white"
              >
                초대 링크 복사
              </button>

              {copyMessage && (
                <p className="mt-2 text-xs font-medium text-[#6264F6]">
                  {copyMessage}
                </p>
              )}
            </div>
          )}
        </header>

        <div className="mt-5">
          {activeTab === "home" ? (
            <HomePage
              tripId={profile.tripId}
              tripName={profile.tripName}
              nickname={profile.nickname}
              onNavigate={setActiveTab}
            />
          ) : activeTab === "trip" ? (
            <TripPage
              tripId={profile.tripId}
              tripName={profile.tripName}
              nickname={profile.nickname}
              participantId={profile.participantId}
              inviteLink={inviteLink}
              onCopyInviteLink={handleCopyInviteLink}
              copyMessage={copyMessage}
            />
          ) : activeTab === "places" ? (
            <PlacesPage
              tripId={profile.tripId}
              participantId={profile.participantId}
              onAddPlace={() => setShowAddPlace(true)}
            />
          ) : activeTab === "vote" ? (
            <VotePage
              tripId={profile.tripId}
              participantId={profile.participantId}
            />
          ) : (
            <GoogleMap
              tripId={profile.tripId}
              participantId={profile.participantId}
              focusAddPlace={focusAddPlace && activeTab === "map"}
              onAddPlace={() => setShowAddPlace(true)}
            />
          )}
        </div>

        <BottomNavigation
          activeTab={activeTab}
          onChange={(tab) => {
            setFocusAddPlace(false);
            setActiveTab(tab);
          }}
        />

        {showAddPlace && (
          <AddPlaceModal
            tripId={profile.tripId}
            participantId={profile.participantId}
            onClose={() => setShowAddPlace(false)}
            onSaved={() => setShowAddPlace(false)}
          />
        )}
      </div>
    </main>
  );
}