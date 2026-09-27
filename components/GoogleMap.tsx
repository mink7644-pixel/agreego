"use client";

import { useEffect, useRef, useState } from "react";
import {
  importLibrary,
  setOptions,
} from "@googlemaps/js-api-loader";
import { supabase } from "../lib/supabase";

type VoteOption =
  | "must_go"
  | "would_like"
  | "neutral"
  | "skip";

type ResultCategory =
  | "recommended"
  | "discussion"
  | "low_priority"
  | "needs_vote";
  
type Place = {
  id: string;

  externalPlaceId: string | null;

  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  userRatingCount: number;

  isConfirmed: boolean;
  confirmedOrder: number | null;

  recommendationReason: string;
  addedBy: string | null;

  initialVotes: Record<
    VoteOption,
    number
  >;
};

type GoogleMapProps = {
  tripId: string;
  participantId: string;
};

type SelectedGooglePlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type PlaceRow = {
  id: string;
  external_place_id: string | null;
  name: string;
  category: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  user_rating_count: number | null;
  is_confirmed: boolean;
  confirmed_order: number | null;

  recommendation_reason: string | null;
  added_by: string | null;
};

type VoteRow = {
  id: string;
  trip_id: string;
  place_id: string;
  participant_id: string;
  preference: VoteOption;
};

type ParticipantRow = {
  id: string;
  nickname: string;
  created_at: string;
};

const resultCategoryLabels: Record<
  ResultCategory,
  string
> = {
  recommended: "함께 가고 싶음",
  discussion: "의견 조율 필요",
  low_priority: "우선순위 낮음",
  needs_vote: "투표 필요",
};

const voteLabels: Record<VoteOption, string> = {
  must_go: "꼭 가고 싶어요",
  would_like: "가면 좋아요",
  neutral: "상관없어요",
  skip: "이번에는 빼고 싶어요",
};

const voteStyles: Record<VoteOption, string> = {
  must_go: "border-red-300 bg-red-50 text-red-700",
  would_like:
    "border-blue-300 bg-blue-50 text-blue-700",
  neutral:
    "border-gray-300 bg-gray-50 text-gray-700",
  skip: "border-orange-300 bg-orange-50 text-orange-700",
};

export default function GoogleMap({
  tripId,
  participantId,
}: GoogleMapProps) {
  const mapContainerRef =
    useRef<HTMLDivElement>(null);

  const mapRef =
    useRef<google.maps.Map | null>(null);

  const autocompleteContainerRef =
    useRef<HTMLDivElement | null>(null);

  const autocompleteElementRef =
    useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null,
  );

  const [
    selectedGooglePlace,
    setSelectedGooglePlace,
  ] = useState<SelectedGooglePlace | null>(
    null,
  );

  const [
    isLoadingPlaceDetails,
    setIsLoadingPlaceDetails,
  ] = useState(false);

  const markerClassRef = useRef<
    typeof google.maps.marker.AdvancedMarkerElement | null
  >(null);

  const markersRef = useRef<
    google.maps.marker.AdvancedMarkerElement[]
  >([]);

  const [isMapReady, setIsMapReady] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [places, setPlaces] =
    useState<Place[]>([]);

  const [selectedPlaceId, setSelectedPlaceId] =
    useState("");

  const [isLoadingPlaces, setIsLoadingPlaces] =
    useState(true);

  const [realtimeStatus, setRealtimeStatus] =
    useState<
      "connecting" | "connected" | "error"
    >("connecting");

  const [recommendationReason, setRecommendationReason] =
    useState("");

  const [votes, setVotes] =
    useState<VoteRow[]>([]);

  const [isLoadingVotes, setIsLoadingVotes] =
    useState(true);

  const [savingVotePlaceId, setSavingVotePlaceId] =
    useState<string | null>(null);

  const [selectedFilter, setSelectedFilter] =
    useState<"all" | ResultCategory>("all");

  const [participants, setParticipants] =
    useState<ParticipantRow[]>([]);

  const [
    isLoadingParticipants,
    setIsLoadingParticipants,
  ] = useState(true);

  function convertPlaceRow(row: PlaceRow): Place {
    return {
      id: row.id,
      externalPlaceId: row.external_place_id,
      name: row.name,
      category: row.category ?? "기타",
      address: row.address ?? "주소 정보 없음",
      latitude: row.latitude,
      longitude: row.longitude,
      rating: row.rating ?? 0,
      userRatingCount: row.user_rating_count ?? 0,

      isConfirmed: row.is_confirmed,
      confirmedOrder: row.confirmed_order,

      recommendationReason: row.recommendation_reason ?? "",

      addedBy: row.added_by,

      initialVotes: {
        must_go: 0,
        would_like: 0,
        neutral: 0,
        skip: 0,
      },
    };
  }

  /*
   * 현재 여행방의 후보 장소 불러오기
   */
  useEffect(() => {
    let isCancelled = false;

    async function loadPlaces() {
      setIsLoadingPlaces(true);

      const { data, error } = await supabase
        .from("places")
        .select(
          `
            id,
            external_place_id,
            name,
            category,
            address,
            latitude,
            longitude,
            rating,
            user_rating_count,
            is_confirmed,
            confirmed_order,
            recommendation_reason,
            added_by
          `,
        )
        .eq("trip_id", tripId)
        .order("created_at", {
          ascending: true,
        });

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error(error);

        setErrorMessage(
          "후보 장소를 불러오지 못했습니다.",
        );

        setIsLoadingPlaces(false);
        return;
      }

      const loadedPlaces = (
        (data ?? []) as PlaceRow[]
      ).map(convertPlaceRow);

      setPlaces(loadedPlaces);

      if (loadedPlaces.length > 0) {
        setSelectedPlaceId(
          loadedPlaces[0].id,
        );
      } else {
        setSelectedPlaceId("");
      }

      setIsLoadingPlaces(false);
    }

    loadPlaces();

    return () => {
      isCancelled = true;
    };
  }, [tripId]);

  /*
   * 현재 여행방의 모든 투표 불러오기
   */
  useEffect(() => {
    let isCancelled = false;

    async function loadVotes() {
      setIsLoadingVotes(true);

      const { data, error } = await supabase
        .from("votes")
        .select(
          `
            id,
            trip_id,
            place_id,
            participant_id,
            preference
          `,
        )
        .eq("trip_id", tripId);

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error(error);

        setErrorMessage(
          "투표 결과를 불러오지 못했습니다.",
        );

        setIsLoadingVotes(false);
        return;
      }

      setVotes((data ?? []) as VoteRow[]);
      setIsLoadingVotes(false);
    }

    loadVotes();

    return () => {
      isCancelled = true;
    };
  }, [tripId]);

  /*
  * 현재 여행방의 참여자 목록 불러오기
  */
  useEffect(() => {
    let isCancelled = false;

    async function loadParticipants() {
      setIsLoadingParticipants(true);

      const { data, error } = await supabase
        .from("participants")
        .select(
          `
            id,
            nickname,
            created_at
          `,
        )
        .eq("trip_id", tripId)
        .order("created_at", {
          ascending: true,
        });

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error(error);

        setErrorMessage(
          "참여자 목록을 불러오지 못했습니다.",
        );

        setIsLoadingParticipants(false);
        return;
      }

      setParticipants(
        (data ?? []) as ParticipantRow[],
      );

      setIsLoadingParticipants(false);
    }

    loadParticipants();

    return () => {
      isCancelled = true;
    };
  }, [tripId]);

  /*
   * 장소와 투표 변경을 실시간으로 반영
   */
  useEffect(() => {
    let isCancelled = false;

    async function refreshPlaces() {
      const { data, error } = await supabase
        .from("places")
        .select(
          `
            id,
            external_place_id,
            name,
            category,
            address,
            latitude,
            longitude,
            rating,
            user_rating_count,
            is_confirmed,
            confirmed_order,
            recommendation_reason,
            added_by
          `,
        )
        .eq("trip_id", tripId)
        .order("created_at", {
          ascending: true,
        });

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error(
          "실시간 장소 갱신 실패:",
          error,
        );

        setErrorMessage(
          "최신 후보 장소를 불러오지 못했습니다.",
        );

        return;
      }

      const refreshedPlaces = (
        (data ?? []) as PlaceRow[]
      ).map(convertPlaceRow);

      setPlaces(refreshedPlaces);

      /*
      * 현재 보고 있던 장소가 삭제되었다면
      * 첫 번째 장소로 선택을 이동
      */
      setSelectedPlaceId(
        (currentSelectedPlaceId) => {
          const selectedPlaceStillExists =
            refreshedPlaces.some(
              (place) =>
                place.id ===
                currentSelectedPlaceId,
            );

          if (selectedPlaceStillExists) {
            return currentSelectedPlaceId;
          }

          return refreshedPlaces[0]?.id ?? "";
        },
      );
    }

    async function refreshVotes() {
      const { data, error } = await supabase
        .from("votes")
        .select(
          `
            id,
            trip_id,
            place_id,
            participant_id,
            preference
          `,
        )
        .eq("trip_id", tripId);

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error(
          "실시간 투표 갱신 실패:",
          error,
        );

        setErrorMessage(
          "최신 투표 결과를 불러오지 못했습니다.",
        );

        return;
      }

      setVotes((data ?? []) as VoteRow[]);
    }

    async function refreshParticipants() {
      const { data, error } = await supabase
        .from("participants")
        .select(
          `
            id,
            nickname,
            created_at
          `,
        )
        .eq("trip_id", tripId)
        .order("created_at", {
          ascending: true,
        });

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error(
          "실시간 참여자 갱신 실패:",
          error,
        );

        return;
      }

      setParticipants(
        (data ?? []) as ParticipantRow[],
      );
    }

    const channel = supabase
      .channel(`trip-realtime-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
        },
        () => {
          refreshPlaces();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
        },
        () => {
          refreshVotes();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
        },
        () => {
          refreshParticipants();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          setRealtimeStatus("error");
        }
      });

    return () => {
      isCancelled = true;

      supabase.removeChannel(channel);
    };
  }, [tripId]);
  
  /*
   * 지도 자체는 처음 한 번만 생성
   */
  useEffect(() => {
    let isCancelled = false;

    async function loadMap() {
      const apiKey =
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        setErrorMessage(
          "Google Maps API 키를 찾을 수 없습니다.",
        );
        return;
      }

      if (!mapContainerRef.current) {
        return;
      }

      try {
        setOptions({
          key: apiKey,
          v: "weekly",
          language: "ko",
          region: "KR",
        });

        const { Map } =
          (await importLibrary(
            "maps",
          )) as google.maps.MapsLibrary;

        const { AdvancedMarkerElement } =
          (await importLibrary(
            "marker",
          )) as google.maps.MarkerLibrary;

        if (isCancelled) {
          return;
        }

        const map = new Map(mapContainerRef.current, {
          center: {
            lat: 37.578,
            lng: 126.986,
          },
          zoom: 14,
          mapId: "DEMO_MAP_ID",
        });

        mapRef.current = map;
        markerClassRef.current =
          AdvancedMarkerElement;

        setIsMapReady(true);
      } catch (error) {
        console.error(error);

        setErrorMessage(
          "Google 지도를 불러오지 못했습니다.",
        );
      }
    }

    loadMap();

    return () => {
      isCancelled = true;

      markersRef.current.forEach((marker) => {
        marker.map = null;
      });

      markersRef.current = [];
      mapRef.current = null;
    };
  }, []);

  /*
   * Google Places 검색창 생성
   */
  useEffect(() => {
    const container =
      autocompleteContainerRef.current;

    if (!container) {
      return;
    }

    let isCancelled = false;
    let autocompleteElement:
      | google.maps.places.PlaceAutocompleteElement
      | null = null;

    async function initializeAutocomplete() {
      try {
        const container =
          autocompleteContainerRef.current;

        if (!container) {
          return;
        }

        const { PlaceAutocompleteElement } =
          (await google.maps.importLibrary(
            "places",
          )) as google.maps.PlacesLibrary;

        if (isCancelled) {
          return;
        }

        autocompleteElement =
          new PlaceAutocompleteElement({
            placeholder:
              "가고 싶은 장소를 검색해주세요",
          });

        autocompleteElementRef.current =
          autocompleteElement;

        /*
        * 한국어 검색 결과를 우선 표시
        */
        autocompleteElement.setAttribute(
          "aria-label",
          "여행 장소 검색",
        );

        /*
        * 개발 중 React Strict Mode에서
        * 검색창이 중복 생성되는 것을 방지
        */
        if (!container) {
          return;
        }

        container.replaceChildren(
          autocompleteElement,
        );

        autocompleteElement.addEventListener(
          "gmp-select",
          async (
            event: google.maps.places.PlacePredictionSelectEvent,
          ) => {
            setIsLoadingPlaceDetails(true);
            setErrorMessage("");

            try {
              const place =
                event.placePrediction.toPlace();

              /*
              * 비용 절감을 위해 필요한 필드만 요청
              */
              await place.fetchFields({
                fields: [
                  "id",
                  "displayName",
                  "formattedAddress",
                  "location",
                ],
              });

              if (
                !place.id ||
                !place.displayName ||
                !place.location
              ) {
                setErrorMessage(
                  "선택한 장소의 정보를 불러오지 못했습니다.",
                );
                return;
              }

              const nextPlace: SelectedGooglePlace =
                {
                  id: place.id,
                  name: place.displayName,
                  address:
                    place.formattedAddress ??
                    "주소 정보 없음",
                  latitude:
                    place.location.lat(),
                  longitude:
                    place.location.lng(),
                };

              setSelectedGooglePlace(nextPlace);

              /*
              * 선택한 장소로 지도 이동
              */
              if (mapRef.current) {
                mapRef.current.panTo({
                  lat: nextPlace.latitude,
                  lng: nextPlace.longitude,
                });

                mapRef.current.setZoom(16);
              }
            } catch (error) {
              console.error(
                "Google 장소 정보 조회 실패:",
                error,
              );

              setErrorMessage(
                "장소 정보를 불러오지 못했습니다.",
              );
            } finally {
              setIsLoadingPlaceDetails(false);
            }
          },
        );

        autocompleteElement.addEventListener(
          "gmp-error",
          () => {
            setErrorMessage(
              "Google 장소 검색에 문제가 발생했습니다.",
            );
          },
        );
      } catch (error) {
        console.error(
          "Google Places 초기화 실패:",
          error,
        );

        setErrorMessage(
          "Google 장소 검색을 시작하지 못했습니다.",
        );
      }
    }

    initializeAutocomplete();

    return () => {
      isCancelled = true;

      if (autocompleteElement) {
        autocompleteElement.remove();
      }

      autocompleteElementRef.current = null;
      container.replaceChildren();
    };
  }, []);

  /*
   * 장소 목록이 바뀔 때마다 핀을 새로 표시
   */
  useEffect(() => {
    if (
      !isMapReady ||
      !mapRef.current ||
      !markerClassRef.current
    ) {
      return;
    }

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });

    markersRef.current = [];

    places.forEach((place) => {
      const marker =
        new markerClassRef.current!({
          map: mapRef.current,
          position: {
            lat: place.latitude,
            lng: place.longitude,
          },
          title: place.name,
        });

      marker.addListener("click", () => {
        handlePlaceClick(place);
      });

      markersRef.current.push(marker);
    });
  }, [places, isMapReady]);

  function handlePlaceClick(place: Place) {
    setSelectedPlaceId(place.id);

    if (!mapRef.current) {
      return;
    }

    mapRef.current.panTo({
      lat: place.latitude,
      lng: place.longitude,
    });

    mapRef.current.setZoom(16);
  }
  async function handleCopyResult() {
    if (places.length === 0) {
      setErrorMessage(
        "공유할 후보 장소가 없습니다.",
      );
      return;
    }

    const confirmedPlaces = places
      .filter((place) => place.isConfirmed)
      .sort(
        (a, b) =>
          (a.confirmedOrder ?? 999) -
          (b.confirmedOrder ?? 999),
      );

    const candidateLines = places.map(
      (place) => {
        const totalVotes =
          getTotalVoteCount(place);

        return `• ${place.name} - ${totalVotes}명 투표`;
      },
    );

    const confirmedLines =
      confirmedPlaces.length > 0
        ? confirmedPlaces.map(
            (place, index) =>
              `${index + 1}. ${place.name}`,
          )
        : ["아직 확정된 장소가 없습니다."];

    const resultText = [
      "✈️ AgreeGo 여행 장소 투표 결과",
      "",
      "📍 후보 장소",
      ...candidateLines,
      "",
      "✅ 최종 확정",
      ...confirmedLines,
      "",
      "같이 여행 계획을 완성해요!",
      window.location.href,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(
        resultText,
      );

      setErrorMessage("");
      alert("투표 결과를 복사했습니다!");
    } catch (error) {
      console.error(
        "결과 복사 실패:",
        error,
      );

      setErrorMessage(
        "결과를 복사하지 못했습니다.",
      );
    }
  }
  async function handleAddPlace() {
    if (!selectedGooglePlace) {
      setErrorMessage(
        "Google 검색 결과에서 장소를 선택해주세요.",
      );
      return;
    }

    const trimmedReason =
      recommendationReason.trim();

    if (!trimmedReason) {
      setErrorMessage(
        "이 장소를 추천하는 이유를 입력해주세요.",
      );
      return;
    }

    if (trimmedReason.length > 100) {
      setErrorMessage(
        "추천 이유는 100자 이내로 입력해주세요.",
      );
      return;
    }

    /*
    * 현재 화면에 이미 있는 장소인지 먼저 확인
    */
    const isAlreadyAdded = places.some(
      (place) =>
        place.externalPlaceId ===
        selectedGooglePlace.id,
    );

    if (isAlreadyAdded) {
      setErrorMessage(
        "이미 후보 목록에 추가된 장소입니다.",
      );
      return;
    }

    const { data, error } = await supabase
      .from("places")
      .insert({
        trip_id: tripId,
        external_place_id:
          selectedGooglePlace.id,

        name: selectedGooglePlace.name,
        category: "기타",
        address:
          selectedGooglePlace.address,

        /*
        * 지도 마커를 위해 내부적으로 저장
        */
        latitude:
          selectedGooglePlace.latitude,
        longitude:
          selectedGooglePlace.longitude,

        /*
        * 비용 절감을 위해 Google에서 요청하지 않음
        */
        rating: null,
        user_rating_count: null,

        added_by: participantId,
        recommendation_reason:
          trimmedReason,
      })
      .select(`
        id,
        external_place_id,
        name,
        category,
        address,
        latitude,
        longitude,
        rating,
        user_rating_count,
        is_confirmed,
        confirmed_order,
        recommendation_reason,
        added_by
      `)
      .single();

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        setErrorMessage(
          "이미 후보 목록에 추가된 장소입니다.",
        );
      } else {
        setErrorMessage(
          "후보 장소를 추가하지 못했습니다.",
        );
      }

      return;
    }

    const addedPlace = convertPlaceRow(
      data as PlaceRow,
    );

    setPlaces((previousPlaces) => [
      ...previousPlaces,
      addedPlace,
    ]);

    setSelectedPlaceId(addedPlace.id);
    setSelectedGooglePlace(null);
    setRecommendationReason("");

    if (autocompleteElementRef.current) {
      autocompleteElementRef.current.value = "";
    }

    setErrorMessage("");

    /*
    * 추가한 장소로 지도 이동
    */
    if (mapRef.current) {
      mapRef.current.panTo({
        lat: addedPlace.latitude,
        lng: addedPlace.longitude,
      });

      mapRef.current.setZoom(16);
    }
  }

  async function handleDeletePlace(placeId: string) {
    const placeToDelete = places.find(
      (place) => place.id === placeId,
    );

    if (!placeToDelete) {
      return;
    }

    const shouldDelete = window.confirm(
      `${placeToDelete.name}을(를) 후보에서 삭제할까요?`,
    );

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase
      .from("places")
      .delete()
      .eq("id", placeId)
      .eq("trip_id", tripId);

    if (error) {
      console.error(error);

      setErrorMessage(
        "후보 장소를 삭제하지 못했습니다.",
      );

      return;
    }

    const remainingPlaces = places.filter(
      (place) => place.id !== placeId,
    );

    setPlaces(remainingPlaces);

    setVotes((previousVotes) =>
      previousVotes.filter(
        (vote) => vote.place_id !== placeId,
      ),
    );

    if (selectedPlaceId === placeId) {
      setSelectedPlaceId(
        remainingPlaces[0]?.id ?? "",
      );
    }
  }

  async function handleToggleConfirm(place: Place) {
    const nextIsConfirmed = !place.isConfirmed;

    const highestOrder = places.reduce(
      (highest, currentPlace) => {
        return Math.max(
          highest,
          currentPlace.confirmedOrder ?? 0,
        );
      },
      0,
    );

    const { error } = await supabase
      .from("places")
      .update({
        is_confirmed: nextIsConfirmed,
        confirmed_order: nextIsConfirmed
          ? highestOrder + 1
          : null,
      })
      .eq("id", place.id)
      .eq("trip_id", tripId);

    if (error) {
      console.error(error);

      setErrorMessage(
        nextIsConfirmed
          ? "장소를 최종 확정하지 못했습니다."
          : "장소 확정을 취소하지 못했습니다.",
      );

      return;
    }

    /*
    * Realtime 수신 전 현재 화면을 먼저 반영
    */
    setPlaces((previousPlaces) =>
      previousPlaces.map((currentPlace) =>
        currentPlace.id === place.id
          ? {
              ...currentPlace,
              isConfirmed: nextIsConfirmed,
              confirmedOrder: nextIsConfirmed
                ? highestOrder + 1
                : null,
            }
          : currentPlace,
      ),
    );
  }

  async function handleResetTripData() {
    const shouldReset = window.confirm(
      "후보 장소, 투표, 확정 결과를 모두 초기화할까요?",
    );

    if (!shouldReset) {
      return;
    }

    const { error } = await supabase
      .from("places")
      .delete()
      .eq("trip_id", tripId);

    if (error) {
      console.error(error);

      setErrorMessage(
        "여행 데이터를 초기화하지 못했습니다.",
      );

      return;
    }

    setPlaces([]);
    setVotes([]);
    setSelectedPlaceId("");
    setSelectedFilter("all");

    if (mapRef.current) {
      mapRef.current.panTo({
        lat: 37.578,
        lng: 126.986,
      });

      mapRef.current.setZoom(14);
    }
  }

  function getMyVote(placeId: string) {
    return votes.find(
      (vote) =>
        vote.place_id === placeId &&
        vote.participant_id === participantId,
    );
  }

  function getParticipantNickname(
    participantIdToFind: string | null,
  ) {
    if (!participantIdToFind) {
      return "알 수 없는 참여자";
    }

    const participant = participants.find(
      (currentParticipant) =>
        currentParticipant.id ===
        participantIdToFind,
    );

    return participant?.nickname ??
      "알 수 없는 참여자";
  }

  function getVotedParticipantIds(
    placeId: string,
  ) {
    return new Set(
      votes
        .filter(
          (vote) =>
            vote.place_id === placeId,
        )
        .map(
          (vote) =>
            vote.participant_id,
        ),
    );
  }

  function getNotVotedParticipants(
    placeId: string,
  ) {
    const votedParticipantIds =
      getVotedParticipantIds(placeId);

    return participants.filter(
      (participant) =>
        !votedParticipantIds.has(
          participant.id,
        ),
    );
  }

  async function handleVote(
    placeId: string,
    preference: VoteOption,
  ) {
    if (savingVotePlaceId) {
      return;
    }

    setSavingVotePlaceId(placeId);
    setErrorMessage("");

    const existingVote = getMyVote(placeId);

    try {
      /*
      * 같은 항목을 다시 누르면 투표 취소
      */
      if (
        existingVote?.preference === preference
      ) {
        const { error } = await supabase
          .from("votes")
          .delete()
          .eq("id", existingVote.id)
          .eq("participant_id", participantId);

        if (error) {
          throw error;
        }

        setVotes((previousVotes) =>
          previousVotes.filter(
            (vote) => vote.id !== existingVote.id,
          ),
        );

        return;
      }

      /*
      * 기존 투표가 있으면 변경,
      * 없으면 새 투표 생성
      */
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
          {
            onConflict:
              "place_id,participant_id",
          },
        )
        .select(
          `
            id,
            trip_id,
            place_id,
            participant_id,
            preference
          `,
        )
        .single();

      if (error) {
        throw error;
      }

      const savedVote = data as VoteRow;

      setVotes((previousVotes) => {
        const otherVotes = previousVotes.filter(
          (vote) =>
            !(
              vote.place_id === placeId &&
              vote.participant_id ===
                participantId
            ),
        );

        return [...otherVotes, savedVote];
      });
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "투표를 저장하지 못했습니다.",
      );
    } finally {
      setSavingVotePlaceId(null);
    }
  }

  function getVoteCount(
    place: Place,
    preference: VoteOption,
  ) {
    return votes.filter(
      (vote) =>
        vote.place_id === place.id &&
        vote.preference === preference,
    ).length;
  }

  function getTotalVoteCount(place: Place) {
    return votes.filter(
      (vote) => vote.place_id === place.id,
    ).length;
  }

  function getResultCategory(
    place: Place,
  ): ResultCategory {
    const totalVoteCount =
      getTotalVoteCount(place);

    if (
      participants.length > 0 &&
      totalVoteCount < participants.length
    ) {
      return "needs_vote";
    }
    
    const mustGo = getVoteCount(
      place,
      "must_go",
    );

    const wouldLike = getVoteCount(
      place,
      "would_like",
    );

    const neutral = getVoteCount(
      place,
      "neutral",
    );

    const skip = getVoteCount(place, "skip");

    const total =
      mustGo + wouldLike + neutral + skip;

    const positive = mustGo + wouldLike;

    // 아직 아무도 투표하지 않은 장소
    if (total === 0) {
      return "needs_vote";
    }

    // 가고 싶다는 사람과 빼고 싶다는 사람이 모두 존재
    if (positive > 0 && skip > 0) {
      return "discussion";
    }

    // 빼고 싶다는 의견이 긍정 의견 이상
    if (skip >= positive && skip > 0) {
      return "low_priority";
    }

    // 꼭 가고 싶음 또는 가면 좋음이 있는 경우
    if (positive > 0) {
      return "recommended";
    }

    return "needs_vote";
  }

  function getResultLabel(place: Place) {
    const category = getResultCategory(place);

    if (category === "recommended") {
      const mustGo = getVoteCount(
        place,
        "must_go",
      );

      if (mustGo >= 2) {
        return "여러 명이 꼭 가고 싶어 해요";
      }

      if (mustGo === 1) {
        return "누군가의 꼭 가고 싶은 장소예요";
      }

      return "부담 없이 함께 갈 수 있어요";
    }

    if (category === "discussion") {
      return "가고 싶은 의견과 제외 의견이 함께 있어요";
    }

    if (category === "low_priority") {
      return "이번 여행에서는 우선순위가 낮아요";
    }

    return "아직 투표가 더 필요해요";
  }

    const categoryCounts = places.reduce(
      (counts, place) => {
        const category =
          getResultCategory(place);

        counts[category] += 1;

        return counts;
      },
      {
        recommended: 0,
        discussion: 0,
        low_priority: 0,
        needs_vote: 0,
      } satisfies Record<ResultCategory, number>,
    );

    const filteredPlaces =
      selectedFilter === "all"
        ? places
        : places.filter(
            (place) =>
              getResultCategory(place) ===
              selectedFilter,
          );

    const confirmedPlaces = places
      .filter((place) => place.isConfirmed)
      .sort(
        (firstPlace, secondPlace) =>
          (firstPlace.confirmedOrder ?? 0) -
          (secondPlace.confirmedOrder ?? 0),
      );

  return (
    <section className="space-y-6">
      {errorMessage && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="shrink-0 font-bold"
          >
            닫기
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs shadow-sm">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            realtimeStatus === "connected"
              ? "bg-green-500"
              : realtimeStatus === "error"
                ? "bg-red-500"
                : "bg-yellow-400"
          }`}
        />

        <span className="text-gray-600">
          {realtimeStatus === "connected"
            ? "친구들의 변경 사항을 실시간으로 반영하고 있습니다."
            : realtimeStatus === "error"
              ? "실시간 연결에 문제가 있습니다."
              : "실시간 연결 중입니다..."}
        </span>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              여행방 참여자
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              현재 {participants.length}명이 함께하고 있어요.
            </p>
          </div>

          <div className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            {participants.length}명
          </div>
        </div>

        {isLoadingParticipants ? (
          <p className="mt-4 text-sm text-gray-500">
            참여자를 불러오는 중입니다...
          </p>
        ) : participants.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            아직 참여자가 없습니다.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {participants.map(
              (participant) => (
                <div
                  key={participant.id}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    participant.id ===
                    participantId
                      ? "border-blue-200 bg-blue-50 font-bold text-blue-700"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                  }`}
                >
                  {participant.nickname}
                  {participant.id ===
                    participantId && (
                    <span className="ml-1 text-xs">
                      나
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div>
        <div
          ref={mapContainerRef}
          className="h-[420px] w-full overflow-hidden rounded-2xl bg-gray-200"
        />

        <p className="mt-2 text-xs text-gray-500">
          지도 핀이나 장소 카드를 누르면 해당
          위치로 이동합니다.
        </p>
      </div>

      {/* 최종 확정 장소 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              최종 확정 장소
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              실제 일정에 넣을 장소를 모아보세요.
            </p>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
            {confirmedPlaces.length}곳
          </span>
        </div>

        {confirmedPlaces.length === 0 ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-6 text-center">
            <p className="text-sm font-medium text-gray-700">
              아직 확정된 장소가 없습니다.
            </p>

            <p className="mt-1 text-xs text-gray-500">
              후보 장소 카드에서 최종 확정을 눌러보세요.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {confirmedPlaces.map((place, index) => (
              <div
                key={place.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50 p-4"
              >
                <button
                  type="button"
                  onClick={() =>
                    handlePlaceClick(place)
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-xs font-bold text-blue-600">
                    확정 장소 {index + 1}
                  </p>

                  <p className="mt-1 truncate font-bold text-gray-900">
                    {place.name}
                  </p>

                  <p className="mt-1 truncate text-xs text-gray-600">
                    {place.address}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleToggleConfirm(place)
                  }
                  className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:text-red-600"
                >
                  확정 취소
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 투표 결과 요약 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-900">
              투표 결과 요약
            </h2>

            <button
              type="button"
              onClick={handleCopyResult}
              className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              결과 공유
            </button>
          </div>

          <p className="mt-1 text-sm text-gray-600">
            후보 장소가 현재 어떻게 분류되고
            있는지 확인해보세요.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() =>
              setSelectedFilter("recommended")
            }
            className="rounded-xl bg-green-50 p-4 text-left hover:bg-green-100"
          >
            <p className="text-xs font-medium text-green-700">
              함께 가고 싶음
            </p>

            <p className="mt-1 text-2xl font-bold text-green-900">
              {categoryCounts.recommended}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedFilter("discussion")
            }
            className="rounded-xl bg-yellow-50 p-4 text-left hover:bg-yellow-100"
          >
            <p className="text-xs font-medium text-yellow-700">
              의견 조율 필요
            </p>

            <p className="mt-1 text-2xl font-bold text-yellow-900">
              {categoryCounts.discussion}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedFilter("low_priority")
            }
            className="rounded-xl bg-red-50 p-4 text-left hover:bg-red-100"
          >
            <p className="text-xs font-medium text-red-700">
              우선순위 낮음
            </p>

            <p className="mt-1 text-2xl font-bold text-red-900">
              {categoryCounts.low_priority}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedFilter("needs_vote")
            }
            className="rounded-xl bg-gray-100 p-4 text-left hover:bg-gray-200"
          >
            <p className="text-xs font-medium text-gray-600">
              투표 필요
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {categoryCounts.needs_vote}
            </p>
          </button>
        </div>
      </div>

      {/* 후보 장소 추가 영역 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              후보 장소 추가
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              가고 싶은 장소를 검색하고 추천 이유를 남겨주세요.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetTripData}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            전체 초기화
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div>
            <label className="text-sm font-semibold text-gray-800">
              가고 싶은 장소
            </label>

            <div
              ref={autocompleteContainerRef}
              className="mt-2 min-h-12 w-full"
            />

            {isLoadingPlaceDetails && (
              <p className="mt-2 text-xs text-gray-500">
                장소 정보를 불러오는 중입니다...
              </p>
            )}
          </div>

          {selectedGooglePlace && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-700">
                선택한 장소
              </p>

              <p className="mt-1 font-bold text-gray-900">
                {selectedGooglePlace.name}
              </p>

              <p className="mt-1 text-sm leading-5 text-gray-600">
                {selectedGooglePlace.address}
              </p>

              <button
                type="button"
                onClick={() => {
                  setSelectedGooglePlace(null);

                  if (autocompleteElementRef.current) {
                    autocompleteElementRef.current.value = "";
                  }
                }}
                className="mt-3 text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                선택 취소
              </button>
            </div>
          )}

          <div>
            <label
              htmlFor="recommendation-reason"
              className="text-sm font-semibold text-gray-800"
            >
              이 장소를 추천하는 이유
            </label>

            <textarea
              id="recommendation-reason"
              value={recommendationReason}
              onChange={(event) => {
                setRecommendationReason(
                  event.target.value,
                );

                setErrorMessage("");
              }}
              placeholder="예: 한복 입고 사진 찍기 좋을 것 같아서"
              maxLength={100}
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {recommendationReason.length} / 100
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddPlace}
            disabled={
              !selectedGooglePlace ||
              !recommendationReason.trim()
            }
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            후보 장소 추가
          </button>
        </div>
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            후보 장소
          </h2>

          {isLoadingVotes && (
            <div className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
              투표 결과를 불러오는 중입니다...
            </div>
          )}

          <p className="mt-1 text-sm text-gray-600">
            총 {places.length}개의 장소 중{" "}
            {filteredPlaces.length}개를 보고 있습니다.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedFilter("all")
              }
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                selectedFilter === "all"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-600"
              }`}
            >
              전체 {places.length}
            </button>

            {(
              Object.keys(
                resultCategoryLabels,
              ) as ResultCategory[]
            ).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setSelectedFilter(category)
                }
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  selectedFilter === category
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-600"
                }`}
              >
                {resultCategoryLabels[category]}{" "}
                {categoryCounts[category]}
              </button>
            ))}
          </div>
        </div>
        {isLoadingPlaces ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              후보 장소를 불러오는 중입니다...
            </p>
          </div>
        ) : places.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-medium text-gray-700">
              등록된 후보 장소가 없습니다.
            </p>

            <p className="mt-2 text-sm text-gray-500">
              위에서 장소를 추가해보세요.
            </p>
          </div>
        ) : filteredPlaces.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="font-medium text-gray-700">
              이 결과에 해당하는 장소가 없습니다.
            </p>

            <button
              type="button"
              onClick={() =>
                setSelectedFilter("all")
              }
              className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white"
            >
              전체 장소 보기
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredPlaces.map((place) => {
              const isSelected =
                selectedPlaceId === place.id;

              const myVoteRow = getMyVote(place.id);

              const myVote =
                myVoteRow?.preference;

              const totalVoteCount =
                getTotalVoteCount(place);

              const participantCount =
                participants.length;

              const voteProgress =
                participantCount > 0
                  ? Math.round(
                      (totalVoteCount /
                        participantCount) *
                        100,
                    )
                  : 0;

              const notVotedParticipants =
                getNotVotedParticipants(place.id);

              const recommenderNickname =
                getParticipantNickname(place.addedBy);

              return (
                <article
                  key={place.id}
                  className={`overflow-hidden rounded-2xl bg-white shadow-sm transition ${
                    isSelected
                      ? "ring-2 ring-blue-500"
                      : ""
                  }`}
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        handlePlaceClick(place)
                      }
                      className="w-full p-5 pr-20 text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-blue-600">
                            {place.category}
                          </p>

                          <h3 className="mt-1 text-xl font-bold text-gray-900">
                            {place.name}
                          </h3>

                          <p className="mt-2 text-sm text-gray-600">
                            {place.address}
                          </p>
                        </div>

                        {place.rating > 0 && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                            ⭐ {place.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {place.userRatingCount > 0 && (
                          <>
                            <span>
                              리뷰{" "}
                              {place.userRatingCount.toLocaleString()}
                              개
                            </span>

                            <span>·</span>
                          </>
                        )}

                        <span>
                          현재 투표{" "}
                          {getTotalVoteCount(place)}
                          명
                        </span>
                      </div>

                      {place.recommendationReason && (
                      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-xs font-bold text-blue-700">
                          {recommenderNickname}님의 추천
                        </p>

                        <p className="mt-1 text-sm leading-6 text-gray-700">
                          “{place.recommendationReason}”
                        </p>
                      </div>
                      )}

                      <div className="mt-4 rounded-xl bg-gray-50 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-700">
                            투표 진행률
                          </span>

                          <span className="font-bold text-blue-700">
                            {totalVoteCount} /{" "}
                            {participantCount}명
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all"
                            style={{
                              width: `${Math.min(
                                voteProgress,
                                100,
                              )}%`,
                            }}
                          />
                        </div>

                        {participantCount > 0 &&
                          totalVoteCount === participantCount ? (
                            <p className="mt-2 text-xs font-semibold text-green-600">
                              모든 참여자가 투표했어요.
                            </p>
                          ) : notVotedParticipants.length >
                            0 ? (
                            <p className="mt-2 text-xs text-gray-500">
                              미투표:{" "}
                              {notVotedParticipants
                                .map(
                                  (participant) =>
                                    participant.nickname,
                                )
                                .join(", ")}
                            </p>
                          ) : null}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeletePlace(place.id)
                      }
                      className="absolute right-4 top-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="border-t border-gray-100 px-5 py-4">
                    <p className="mb-3 text-sm font-semibold text-gray-800">
                      내 의견
                    </p>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(
                        Object.keys(
                          voteLabels,
                        ) as VoteOption[]
                      ).map((vote) => {
                        const isMyVote =
                          myVote === vote;

                        return (
                          <button
                            key={vote}
                            type="button"
                            disabled={
                              savingVotePlaceId === place.id
                            }
                            onClick={() =>
                              handleVote(place.id, vote)
                            }
                            className={`rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-wait disabled:opacity-60 ${
                              isMyVote
                                ? `${voteStyles[vote]} border-2 font-bold`
                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span>
                                {
                                  voteLabels[
                                    vote
                                  ]
                                }
                              </span>

                              <span className="shrink-0 text-xs">
                                {getVoteCount(
                                  place,
                                  vote,
                                )}
                                명
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-gray-500">
                        현재 결과
                      </p>

                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-600">
                        {
                          resultCategoryLabels[
                            getResultCategory(place)
                          ]
                        }
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-bold text-gray-800">
                      {getResultLabel(place)}
                    </p>

                    {myVote ? (
                      <p className="mt-2 text-xs text-blue-600">
                        내가 선택한 의견:{" "}
                        {voteLabels[myVote]}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">
                        아직 이 장소에 투표하지
                        않았습니다.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleToggleConfirm(place)
                      }
                      className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
                        place.isConfirmed
                          ? "border border-blue-200 bg-blue-50 text-blue-700"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      {place.isConfirmed
                        ? "✓ 최종 장소로 확정됨"
                        : "최종 장소로 확정"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}