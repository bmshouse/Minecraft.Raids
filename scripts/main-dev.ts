/**
 * Development entry point - includes GameTest files
 * Use this for local-deploy to enable in-game testing
 */

// Import production initialization
import "./main";

// Import GameTest files to register them (development only)
import "./gametests/WelcomeGameTest";
import "./gametests/MessageProviderGameTest";
import "./gametests/PlayerListGameTest";
import "./gametests/RaidPartyGameTest";
import "./gametests/WolfLevelingGameTest";
import "./gametests/VillageDefenseIronGolemGameTest";
import "./gametests/ResourceServiceGameTest";
import "./gametests/ResourceInitializerGameTest";
import "./gametests/RecruitmentServiceGameTest";
import "./gametests/UnitPocketServiceGameTest";
import "./gametests/VillageDiscoveryGameTest";
import "./gametests/VillageRaidServiceGameTest";
import "./gametests/WealthCalculationGameTest";
