"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//playerID = gamemode.actor.getUniqueIdBin()
//TODO
const event_1 = require("bdsx/event");
const capi_1 = require("bdsx/capi");
const block_1 = require("bdsx/bds/block");
const blockpos_1 = require("bdsx/bds/blockpos");
const gamemode_1 = require("bdsx/bds/gamemode");
const inventory_1 = require("bdsx/bds/inventory");
const core_1 = require("bdsx/core");
const dbghelp_1 = require("bdsx/dbghelp");
const nativetype_1 = require("bdsx/nativetype");
const prochacker_1 = require("bdsx/prochacker");
const launcher_1 = require("bdsx/launcher");
const actor_1 = require("bdsx/bds/actor");
const form_1 = require("bdsx/bds/form");
const norma_core_1 = require("norma-core");
require("./dist/index.js");
const lastTimeOfPlayerRequest = new Map();
(async () => {
    //TODO:Move it inside the constructor
    const dimensionIdentifier = ["overworld", "nether", "the end"];
    console.log('[plugin:Test] allocated');
    event_1.events.serverOpen.on(() => {
        console.log('[plugin:Test] launching');
    });
    event_1.events.serverClose.on(() => {
        console.log('[plugin:Test] closed');
    });
    await launcher_1.bedrockServer.afterOpen();
    function assembleUseItemData(player, blockPosition) {
        var _a;
        let entity = player.getEntity();
        let tickingArea = serverSystem.getComponent(entity, "minecraft:tick_world");
        if (!tickingArea)
            throw "NZ IS JULAO!";
        let block = serverSystem.getBlock(tickingArea.data.ticking_area, blockPosition.coordinate);
        if (!block)
            throw "NZ IS JULAO!";
        let blockState = (_a = serverSystem.getComponent(block, "minecraft:blockstate")) === null || _a === void 0 ? void 0 : _a.data;
        let rotation = serverSystem.getComponent(entity, "minecraft:rotation");
        if (!rotation)
            throw "NZ IS JULAO!";
        return {
            blockType: new norma_core_1.BlockType(block === null || block === void 0 ? void 0 : block.__identifier__, blockState),
            position: blockPosition,
            direction: new norma_core_1.Direction(rotation === null || rotation === void 0 ? void 0 : rotation.data.x, rotation === null || rotation === void 0 ? void 0 : rotation.data.y)
        };
    }
    if (!capi_1.capi.isRunningOnWine()) {
        const hacker = prochacker_1.ProcHacker.load('../pdbcache_by_example.ini', [
            'GameMode::useItemOn'
        ], dbghelp_1.UNDNAME_NAME_ONLY);
        core_1.pdb.close();
        //////////////////////////
        // hook the item using on block
        const itemUseOn = hacker.hooking('GameMode::useItemOn', nativetype_1.bool_t, null, gamemode_1.GameMode, inventory_1.ItemStack, blockpos_1.BlockPos, nativetype_1.int8_t, blockpos_1.Vec3, block_1.Block)((gamemode, item, blockPos, n, pos, block) => {
            if (item.getName().startsWith("normaconstructor:")) {
                let playerID = gamemode.actor.getUniqueIdBin();
                let player = actor_1.Actor.fromUniqueIdBin(playerID);
                if (player === null || player === void 0 ? void 0 : player.isPlayer()) {
                    handlePlayerRequest({
                        "requestType": item.getName().slice(item.getName().indexOf(":") + 1),
                        "playerID": playerID,
                        "additionalData": assembleUseItemData(player, new norma_core_1.Position(blockPos.toJSON(), dimensionIdentifier[player.getDimensionId()]))
                    });
                }
            }
            return itemUseOn(gamemode, item, blockPos, n, pos, block);
        });
    }
    event_1.events.command.on((cmd, origin, ctx) => {
        console.log(cmd, origin);
        const player = ctx.origin.getEntity();
        if ((player === null || player === void 0 ? void 0 : player.isPlayer()) && cmd.startsWith("/nos:")) {
            handlePlayerRequest({ requestType: "run_nos", playerID: player.getUniqueIdBin(), additionalData: { nos: cmd.slice("/nos:".length) } });
            return 0;
        }
        return;
    });
    event_1.events.blockPlace.on((e) => {
        handlePlayerRequest({
            "requestType": "get_block_type",
            "playerID": e.player.getUniqueIdBin(),
            "additionalData": assembleUseItemData(e.player, new norma_core_1.Position(e.blockPos.toJSON(), dimensionIdentifier[e.player.getDimensionId()]))
        });
        return;
    });
    const serverSystem = server.registerSystem(0, 0);
    norma_core_1.systemInstance.inject({
        createRuntime: function (id) {
            let user = norma_core_1.systemInstance.getUser(id);
            return {
                logger: loggerFactory(id)
            };
        }
    });
    serverSystem.initialize = function () {
    };
    function getUser(playerID) {
        function registerNewUser(playerID) {
            let user = norma_core_1.systemInstance.createUser(playerID);
            //TODO:Separate the following initialization process from this function.
            user.session["__requestAdditionalPosition"] = false;
            user.session["__requestAdditionalBlockType"] = false;
            user.session["__requestAdditionalDirection"] = false;
            user.session["__logLevel"] = "verbose";
            user.session["__on"] = true;
            return user;
        }
        return norma_core_1.systemInstance.hasUser(playerID) ? norma_core_1.systemInstance.getUser(playerID) : registerNewUser(playerID);
    }
    function handlePlayerRequest({ requestType, playerID, additionalData }) {
        var _a;
        //Debounce.
        const last = lastTimeOfPlayerRequest.get(playerID), now = Date.now();
        lastTimeOfPlayerRequest.set(playerID, now);
        if (last && now - last < 400)
            return;
        let user = getUser(playerID);
        const logger = loggerFactory(playerID);
        logger.logObject("verbose", { requestType, playerID, additionalData });
        switch (requestType) {
            case "get_position":
            case "get_direction":
            case "get_block_type": {
                if (requestType == "get_position" || user.session["__requestAdditionalPosition"])
                    user.addPosition(additionalData.position);
                if (requestType == "get_direction" || user.session["__requestAdditionalDirection"])
                    user.addDirection(additionalData.direction);
                if (requestType == "get_block_type" || user.session["__requestAdditionalBlockType"])
                    user.addBlockType(additionalData.blockType);
                break;
            }
            case "get_air": {
                user.addBlockType(new norma_core_1.BlockType("minecraft:air", {}));
                break;
            }
            case "remove_last_position": {
                logger.log("info", "Removing the last position...");
                user.removePosition();
                break;
            }
            case "remove_last_blocktype": {
                logger.log("info", "Removing the last blockType...");
                user.removeBlockType();
                break;
            }
            case "remove_last_direction": {
                logger.log("info", "Removing the last direction...");
                user.removeDirection();
                break;
            }
            case "choose_next_generator": {
                logger.log("info", "Choosing next generator...");
                user.nextGenerator();
                logger.log("debug", "Current generator:");
                logger.logObject("debug", user.getCurrentGeneratorName());
                break;
            }
            case "show_saved_data": {
                //logger.log("info", "Current positionArray:")
                //logger.logObject("info", generatorArray[generatorIndex].positionArray)
                //logger.log("info", "Current blockTypeArray:")
                //logger.logObject("info", generatorArray[generatorIndex].blockTypeArray)
                //logger.log("info", "Current directionArray:")
                //logger.logObject("info", generatorArray[generatorIndex].directionArray)
                logger.log("info", "Current generator name:");
                logger.logObject("info", user.getCurrentGeneratorName());
                logger.log("info", "Current generator state:");
                logger.logObject("info", user.getCurrentState());
                logger.log("info", "Current session:");
                logger.logObject("info", user.session);
                break;
            }
            case "execute": {
                execute(playerID);
                break;
            }
            case "show_menu": {
                //TODO
                let player = actor_1.Actor.fromUniqueIdBin(playerID);
                const ni = player.getNetworkIdentifier();
                let form = new form_1.CustomForm;
                let user = getUser(playerID);
                let ui = (_a = user.getCurrentUI()) !== null && _a !== void 0 ? _a : [];
                form.setTitle(user.getCurrentGeneratorName());
                ui.forEach((e) => {
                    switch (e["viewtype"]) {
                        case "text": {
                            // form.addLabel(e.text)
                            form.addComponent(new form_1.FormLabel(e.text));
                            break;
                        }
                        case "button":
                        case "checkbox": {
                            let defaultValue = user.getCurrentState()[e.key];
                            let defaultChoice = e.data.findIndex((choice) => choice.value == defaultValue);
                            // form.addDropdown(e.text, Array.from(e.data, choice => choice.text), defaultChoice == -1 ? 0 : defaultChoice)
                            form.addComponent(new form_1.FormDropdown(e.text, Array.from(e.data, (choice) => choice.text), defaultChoice == -1 ? 0 : defaultChoice));
                            break;
                        }
                        case "edittext": {
                            // form.addInput(e.text, "", user.getCurrentState()[e.key])
                            // form.addInput(e.text, `Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString())
                            form.addComponent(new form_1.FormInput(e.text, `Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString()));
                            // form.addInput(e.text,`Input number here`, user.getCurrentState()[e.key].toString())
                            break;
                        }
                    }
                });
                form.sendTo(ni, (form) => {
                    console.log(form);
                    if (!(form.response))
                        return;
                    form.response.forEach((e, i) => {
                        switch (ui[i]["viewtype"]) {
                            case "text": {
                                break;
                            }
                            case "button":
                            case "checkbox": {
                                user.getCurrentState()[ui[i].key] = ui[i].data[e].value;
                                break;
                            }
                            case "edittext": {
                                // form.addInput(e.text, "", user.getCurrentState()[e.key])
                                // form.addInput(e.text,`Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString())
                                user.getCurrentState()[ui[i].key] = e;
                                break;
                            }
                        }
                        if (ui[i].hasOwnProperty("dataForUIHandler"))
                            user.UIHandler(ui[i]["dataForUIHandler"]);
                    });
                });
                break;
            }
            case "show_meta_menu": {
                let player = actor_1.Actor.fromUniqueIdBin(playerID);
                const ni = player.getNetworkIdentifier();
                let form = new form_1.CustomForm;
                form.setTitle("Meta menu");
                form.addComponent(new form_1.FormDropdown("Choose generator:", user.getGeneratorNames(), user.getGeneratorNames().findIndex((e) => e == user.getCurrentGeneratorName())));
                form.sendTo(ni, (form) => {
                    console.log(form);
                    if (!(form.response))
                        return;
                    user.switchGenerator(form.response[0]);
                });
                break;
            }
            case "run_nos": {
                user.runNOS(additionalData.nos, undefined);
                break;
            }
        }
    }
    let compiler = {
        raw: function (blockArray) {
            return blockArray;
        },
        clone: function ({ startCoordinate, endCoordinate, targetCoordinate }) {
            if (startCoordinate.x >= endCoordinate.x) {
                let temp = startCoordinate.x;
                startCoordinate.x = endCoordinate.x;
                endCoordinate.x = temp;
            }
            if (startCoordinate.y >= endCoordinate.y) {
                let temp = startCoordinate.y;
                startCoordinate.y = endCoordinate.y;
                endCoordinate.y = temp;
            }
            if (startCoordinate.z >= endCoordinate.z) {
                let temp = startCoordinate.z;
                startCoordinate.z = endCoordinate.z;
                endCoordinate.z = temp;
            }
            for (let x = startCoordinate.x; x <= endCoordinate.x; x += 32)
                for (let y = startCoordinate.y; y <= endCoordinate.y; y += 32)
                    for (let z = startCoordinate.z; z <= endCoordinate.z; z += 32)
                        serverSystem.executeCommand(`clone ${x} ${y} ${z}
                ${Math.min(x + 31, endCoordinate.x)}
                ${Math.min(y + 31, endCoordinate.y)}
                ${Math.min(z + 31, endCoordinate.z)}
                ${targetCoordinate.x + x - startCoordinate.x}
                ${targetCoordinate.y + y - startCoordinate.y}
                ${targetCoordinate.z + z - startCoordinate.z}
                masked force`, (commandResultData) => { });
            return [];
        },
        fill: function ({ blockType, startCoordinate, endCoordinate }) {
            if (startCoordinate.x >= endCoordinate.x) {
                let temp = startCoordinate.x;
                startCoordinate.x = endCoordinate.x;
                endCoordinate.x = temp;
            }
            if (startCoordinate.y >= endCoordinate.y) {
                let temp = startCoordinate.y;
                startCoordinate.y = endCoordinate.y;
                endCoordinate.y = temp;
            }
            if (startCoordinate.z >= endCoordinate.z) {
                let temp = startCoordinate.z;
                startCoordinate.z = endCoordinate.z;
                endCoordinate.z = temp;
            }
            //Bypass the restriction of 32767 blocks
            for (let x = startCoordinate.x; x <= endCoordinate.x; x += 32)
                for (let y = startCoordinate.y; y <= endCoordinate.y; y += 32)
                    for (let z = startCoordinate.z; z <= endCoordinate.z; z += 32)
                        serverSystem.executeCommand(`fill ${x} ${y} ${z}
                ${Math.min(x + 31, endCoordinate.x)}
                ${Math.min(y + 31, endCoordinate.y)}
                ${Math.min(z + 31, endCoordinate.z)}
                ${blockType.blockIdentifier.slice(blockType.blockIdentifier.indexOf(":") + 1)}
                [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`, (commandResultData) => { });
            return [];
        }
        //TODO
        //,
        // writeBuildingStructureToLog: function ({ startCoordinate, endCoordinate, referenceCoordinate, tickingArea }) {
        //     if (startCoordinate.x >= endCoordinate.x) [startCoordinate.x, endCoordinate.x] = [endCoordinate.x, startCoordinate.x]
        //     if (startCoordinate.y >= endCoordinate.y) [startCoordinate.y, endCoordinate.y] = [endCoordinate.y, startCoordinate.y]
        //     if (startCoordinate.z >= endCoordinate.z) [startCoordinate.z, endCoordinate.z] = [endCoordinate.z, startCoordinate.z]
        //     for (let x = startCoordinate.x; x <= endCoordinate.x; x++)
        //         for (let y = startCoordinate.y; y <= endCoordinate.y; y++)
        //             for (let z = startCoordinate.z; z <= endCoordinate.z; z++) {
        //                 let blockType = new BlockType(undefined, undefined)
        //                 let block = serverSystem.getBlock(tickingArea, new Coordinate(x, y, z))
        //                 blockType.blockIdentifier = block.__identifier__
        //                 blockType.blockState = serverSystem.getComponent(block, "minecraft:blockstate").data
        //                 server.log(JSON.stringify({ coordinate: new Coordinate(x - referenceCoordinate.x, y - referenceCoordinate.y, z - referenceCoordinate.z), blockType: blockType }, null, '    '))
        //             }
        //     return []
        // }
    };
    async function execute(playerID) {
        let user = getUser(playerID);
        let logger = loggerFactory(playerID);
        logger.log("info", "Start validating parameters...");
        let isVaild = await user.isValidParameter();
        if (isVaild) {
            logger.log("info", "Now Execution started.");
            let buildInstructions = await user.generate();
            if (buildInstructions === undefined)
                return;
            logger.logObject("verbose", buildInstructions);
            for (let buildInstruction of buildInstructions) {
                //I know it looks silly... "Compatibility reason".
                if (!buildInstruction.hasOwnProperty("type"))
                    setBlock(buildInstruction);
                else {
                    //Another compromise...
                    //'Compliers' don't just complie: the fill() method can be invoked in which block will be placed directly.
                    let blocks = compiler[buildInstruction.type](buildInstruction.data);
                    for (let block of blocks)
                        setBlock(block);
                }
            }
        }
    }
    function displayObject(object, playerID) {
        displayChat(JSON.stringify(object, null, '    '), playerID);
    }
    function displayChat(message, playerID) {
        if (playerID) {
            let player = actor_1.Actor.fromUniqueIdBin(playerID);
            if (player && player.isPlayer())
                player.sendChat(message, "nc");
            else
                console.log(message);
        }
        else
            serverSystem.executeCommand(`say ${message}`, () => { });
    }
    function setBlock(block) {
        //displayChat("§b We all agree, NZ is JULAO!")
        let blockType = block.blockType;
        let position = block.position;
        let coordinate = position.coordinate;
        // STILL thank you, WavePlayz!
        //TODO:
        //It currently use destroy mode to force replace the old block, but will leave tons of items.
        //Might change to set air block first.
        //NEW TODO: UNDERSTANDING WHAT THE FUDGE I WAS TALKING ABOUT HERE.
        serverSystem.executeCommand(`/setblock ${coordinate.x} ${coordinate.y} ${coordinate.z} ${blockType.blockIdentifier.slice(blockType.blockIdentifier.indexOf(":") + 1)} [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`, (commandResultData) => {
        });
    }
    function loggerFactory(playerID) {
        return {
            displayChat, displayObject,
            log: function (level, message) {
                const colorMap = new Map([
                    ["verbose", { num: 0, color: "§a" }],
                    ["debug", { num: 1, color: "§6" }],
                    ["info", { num: 2, color: "§b" }],
                    ["warning", { num: 3, color: "§e" }],
                    ["error", { num: 4, color: "§c" }],
                    ["fatal", { num: 5, color: "§4" }]
                ]);
                const user = getUser(playerID);
                if (colorMap.get(level).num >= colorMap.get(user.session["__logLevel"]).num)
                    this.displayChat(colorMap.get(level).color + "[" + level + "]" + message, playerID);
            },
            logObject: function (level, object) {
                this.log(level, JSON.stringify(object, null, '    '));
            }
        };
    }
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDRDQUE0QztBQUM1QyxNQUFNO0FBQ04sc0NBQW9DO0FBQ3BDLG9DQUFpQztBQUNqQywwQ0FBOEQ7QUFDOUQsZ0RBQW1EO0FBQ25ELGdEQUEyRDtBQUMzRCxrREFBK0M7QUFDL0Msb0NBQWdDO0FBQ2hDLDBDQUFpRDtBQUNqRCxnREFBMEQ7QUFDMUQsZ0RBQTZDO0FBQzdDLDRDQUE4QztBQUM5QywwQ0FBdUM7QUFFdkMsd0NBQXNJO0FBRXRJLDJDQUEwSztBQUMxSywyQkFBd0I7QUFFeEIsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBRzFDLENBQUMsS0FBSyxJQUFJLEVBQUU7SUFDUixxQ0FBcUM7SUFDckMsTUFBTSxtQkFBbUIsR0FBOEMsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFBO0lBQ3pHLE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUV2QyxjQUFNLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUU7UUFDdEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzNDLENBQUMsQ0FBQyxDQUFDO0lBRUgsY0FBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFO1FBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUV4QyxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sd0JBQWEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNoQyxTQUFTLG1CQUFtQixDQUFDLE1BQWMsRUFBRSxhQUF1Qjs7UUFDaEUsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFBO1FBQy9CLElBQUksV0FBVyxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLHNCQUFzQixD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