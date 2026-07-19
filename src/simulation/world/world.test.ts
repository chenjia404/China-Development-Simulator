import { describe, expect, it } from "vitest";
import { Mulberry32 } from "../core/random";
import { createInitialGameState } from "../state/initial-state";
import { createSimulationEngine } from "../core/engine";
import { calculateRank, calculateWorldRankings } from "./rankings";
import { ensureWorldCountriesState, worldCountryConfigs } from "./countries";
import {
  countryMonthRandomSeed,
  legacySharedWorldCountryIds,
  simulateWorldCountries,
} from "./world-simulation";

describe("世界国家和排名", () => {
  it("初始化外国经济体并包含核心国家、阿尔巴尼亚与后续增补国", () => {
    const state = createInitialGameState(1);
    const ids = new Set(state.world.countries.map((country) => country.id));

    expect(state.world.countries).toHaveLength(64);
    expect(state.world.countries.map((country) => country.id)).toEqual(
      worldCountryConfigs.map((config) => config.id),
    );
    expect(legacySharedWorldCountryIds).not.toContain("albania");
    expect(legacySharedWorldCountryIds).toHaveLength(31);
    for (const countryId of legacySharedWorldCountryIds) {
      expect(worldCountryConfigs.some((config) => config.id === countryId)).toBe(
        true,
      );
    }
    for (const id of [
      "usa",
      "japan",
      "south_korea",
      "germany",
      "france",
      "united_kingdom",
      "russia",
      "india",
      "brazil",
      "singapore",
      "canada",
      "australia",
      "albania",
      "thailand",
      "bangladesh",
      "czechoslovakia",
      "ethiopia",
      "congo_kinshasa",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    const postLegacyIds = worldCountryConfigs
      .map((config) => config.id)
      .filter(
        (id) => !(legacySharedWorldCountryIds as readonly string[]).includes(id),
      );
    expect(postLegacyIds.length).toBe(33);
    expect(postLegacyIds).toContain("albania");
    for (const id of postLegacyIds) {
      expect(legacySharedWorldCountryIds).not.toContain(id);
    }
  });

  it("旧存档缺少阿尔巴尼亚时会按配置补齐并重排顺序", () => {
    const state = createInitialGameState(1);
    const albania = state.world.countries.find(
      (country) => country.id === "albania",
    );
    expect(albania).toBeDefined();
    state.world.countries = state.world.countries.filter(
      (country) => country.id !== "albania",
    );
    state.world.countries.push(albania!);
    expect(state.world.countries.at(-1)?.id).toBe("albania");
    expect(ensureWorldCountriesState(state.world)).toBe(true);
    expect(state.world.countries.map((country) => country.id)).toEqual(
      worldCountryConfigs.map((config) => config.id),
    );
    expect(ensureWorldCountriesState(state.world)).toBe(false);
  });

  it("新增阿尔巴尼亚不改变中国随机流与既有世界国家演化", () => {
    const withAlbania = createInitialGameState(42, 1949, "automatic");
    const withoutAlbania = createInitialGameState(42, 1949, "automatic");
    const withEngine = createSimulationEngine(withAlbania);
    const withoutEngine = createSimulationEngine(withoutAlbania);
    // 引擎构造会补齐缺失国家，因此必须在创建后再剥离，才能真正验证隔离。
    withoutEngine.getState().world.countries = withoutEngine
      .getState()
      .world.countries.filter((country) => country.id !== "albania");
    expect(
      withoutEngine.getState().world.countries.some(
        (country) => country.id === "albania",
      ),
    ).toBe(false);
    expect(
      withEngine.getState().world.countries.some(
        (country) => country.id === "albania",
      ),
    ).toBe(true);

    withEngine.dispatch({ type: "ADVANCE_MONTHS", months: 24 });
    withoutEngine.dispatch({ type: "ADVANCE_MONTHS", months: 24 });

    const withState = withEngine.getState();
    const withoutState = withoutEngine.getState();
    expect(withState.randomState).toBe(withoutState.randomState);
    expect(withoutState.world.countries.some((country) => country.id === "albania"))
      .toBe(false);
    // 外交平均关系会因新增国家而变化，不要求中国人口完全一致；
    // 隔离目标是：共享随机状态与既有世界国家经济路径不变。
    for (const country of withoutState.world.countries) {
      const paired = withState.world.countries.find(
        (item) => item.id === country.id,
      );
      expect(paired?.realGDP).toBeCloseTo(country.realGDP, 8);
      expect(paired?.population).toBeCloseTo(country.population, 8);
    }
    expect(legacySharedWorldCountryIds).toEqual([
      "usa",
      "japan",
      "south_korea",
      "north_korea",
      "germany",
      "france",
      "united_kingdom",
      "russia",
      "india",
      "brazil",
      "singapore",
      "canada",
      "australia",
      "italy",
      "spain",
      "mexico",
      "indonesia",
      "turkey",
      "saudi_arabia",
      "iran",
      "south_africa",
      "argentina",
      "netherlands",
      "switzerland",
      "sweden",
      "norway",
      "poland",
      "egypt",
      "nigeria",
      "pakistan",
      "vietnam",
    ]);
    expect(
      countryMonthRandomSeed(42, "egypt", 1949, 1),
    ).not.toBe(countryMonthRandomSeed(42, "albania", 1949, 1));
    expect(
      countryMonthRandomSeed(42, "thailand", 1949, 1),
    ).not.toBe(countryMonthRandomSeed(42, "bangladesh", 1949, 1));
  });

  it("批量增补的中等体量国家使用独立随机流且不写入共享清单", () => {
    const state = createInitialGameState(7);
    const engine = createSimulationEngine(state);
    const stripped = createSimulationEngine(createInitialGameState(7));
    const newIds = [
      "thailand",
      "bangladesh",
      "czechoslovakia",
      "ethiopia",
      "angola",
    ] as const;
    for (const id of newIds) {
      expect(legacySharedWorldCountryIds).not.toContain(id);
      expect(state.world.countries.some((country) => country.id === id)).toBe(
        true,
      );
    }
    stripped.getState().world.countries = stripped
      .getState()
      .world.countries.filter(
        (country) =>
          !(newIds as readonly string[]).includes(country.id) &&
          country.id !== "albania",
      );

    engine.dispatch({ type: "ADVANCE_MONTHS", months: 12 });
    stripped.dispatch({ type: "ADVANCE_MONTHS", months: 12 });

    const full = engine.getState();
    const lean = stripped.getState();
    expect(full.randomState).toBe(lean.randomState);
    for (const country of lean.world.countries) {
      if (!(legacySharedWorldCountryIds as readonly string[]).includes(country.id)) {
        continue;
      }
      const paired = full.world.countries.find((item) => item.id === country.id);
      expect(paired?.realGDP).toBeCloseTo(country.realGDP, 8);
      expect(paired?.population).toBeCloseTo(country.population, 8);
    }
  });

  it("顺序排名正确且相同数值不会异常", () => {
    const rankings = calculateRank(
      [
        { id: "c", value: 5 },
        { id: "a", value: 10 },
        { id: "b", value: 10 },
      ],
      (country) => country.value,
    );

    expect(rankings.a).toBe(1);
    expect(rankings.b).toBe(2);
    expect(rankings.c).toBe(3);
  });

  it("中国参与所有世界排名且人均指标计算正确", () => {
    const state = createInitialGameState(1);
    calculateWorldRankings(state);

    expect(state.world.rankings.nominalGDP.china).toBeGreaterThan(0);
    expect(state.world.rankings.nominalGDPPerCapita.china).toBeGreaterThan(0);
    expect(state.world.rankings.technology.china).toBeGreaterThan(0);
  });

  it("世界模拟在同一种子下可复现并保持正值", () => {
    const first = createInitialGameState(8);
    const second = createInitialGameState(8);
    const firstRandom = new Mulberry32(8);
    const secondRandom = new Mulberry32(8);

    for (let month = 0; month < 120; month += 1) {
      simulateWorldCountries(first, firstRandom);
      simulateWorldCountries(second, secondRandom);
      first.nation.date.month += 1;
      if (first.nation.date.month > 12) {
        first.nation.date.month = 1;
        first.nation.date.year += 1;
      }
      second.nation.date.month = first.nation.date.month;
      second.nation.date.year = first.nation.date.year;
    }

    expect(second.world).toEqual(first.world);
    expect(first.world.countries.every((country) => country.realGDP > 0)).toBe(true);
  });

  it("阿尔巴尼亚人口增长阶段避免长期超常增长", () => {
    const state = createInitialGameState(9);
    const random = new Mulberry32(9);
    for (let year = 1949; year <= 2026; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        state.nation.date.year = year;
        state.nation.date.month = month;
        simulateWorldCountries(state, random);
      }
    }
    const finalPopulation = state.world.countries.find(
      (country) => country.id === "albania",
    )?.population ?? Number.NaN;
    expect(finalPopulation).toBeGreaterThan(1_800_000);
    expect(finalPopulation).toBeLessThan(3_500_000);
  });
});
