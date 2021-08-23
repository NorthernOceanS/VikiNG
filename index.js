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
        if (!blockState)
            throw "NZ IS JULAO!";
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