//playerID = gamemode.actor.getUniqueIdBin()
//TODO
import { events } from "bdsx/event";
import { capi } from "bdsx/capi";
import { Block as _Block, BlockSource } from "bdsx/bds/block";
import { BlockPos, Vec3 } from "bdsx/bds/blockpos";
import { GameMode, SurvivalMode } from "bdsx/bds/gamemode";
import { ItemStack } from "bdsx/bds/inventory";
import { pdb } from "bdsx/core";
import { UNDNAME_NAME_ONLY } from "bdsx/dbghelp";
import { bool_t, int32_t, int8_t } from "bdsx/nativetype";
import { ProcHacker } from "bdsx/prochacker";
import { bedrockServer } from "bdsx/launcher";
import { Actor } from "bdsx/bds/actor";
import { Player } from "bdsx/bds/player";
import { CustomForm, Form, FormLabel, FormItemButton, FormItemDropdown, FormItemInput, FormDropdown, FormInput } from "bdsx/bds/form";

import { systemInstance as system, Description, Usage, Block, Coordinate, Position, BlockType, Direction, BuildInstruction, canonicalGeneratorFactory } from 'norma-core';
import "./dist/index.js"

const lastTimeOfPlayerRequest = new Map();


(async () => {
    //TODO:Move it inside the constructor
    const dimensionIdentifier: Array<"overworld" | "nether" | "the end"> = ["overworld", "nether", "the end"]
    console.log('[plugin:Test] allocated');

    events.serverOpen.on(() => {
        console.log('[plugin:Test] launching');
    });

    events.serverClose.on(() => {
        console.log('[plugin:Test] closed');

    });

    await bedrockServer.afterOpen();
    function assembleUseItemData(player: Player, blockPosition: Position) {
        let entity = player.getEntity()
        let tickingArea = serverSystem.getComponent(entity, "minecraft:tick_world")
        if (!tickingArea) throw "NZ IS JULAO!"
        let block = serverSystem.getBlock(tickingArea.data.ticking_area, blockPosition.coordinate) as IBlock
        if (!block) throw "NZ IS JULAO!"
        let blockState = serverSystem.getComponent(block, "minecraft:blockstate")?.data
        let rotation = serverSystem.getComponent(entity, "minecraft:rotation")
        if (!rotation) throw "NZ IS JULAO!"
        return {
            blockType: new BlockType(block?.__identifier__, blockState),
            position: blockPosition,
            direction: new Direction(rotation?.data.x, rotation?.data.y)
        }
    }

    if (!capi.isRunningOnWine()) {
        const hacker = ProcHacker.load('../pdbcache_by_example.ini', [
            'GameMode::useItemOn'
        ], UNDNAME_NAME_ONLY);
        pdb.close();
        //////////////////////////
        // hook the item using on block
        const itemUseOn = hacker.hooking('GameMode::useItemOn',
            bool_t, null, GameMode, ItemStack, BlockPos, int8_t, Vec3, _Block)(
                (gamemode, item, blockPos, n, pos, block) => {
                    if (item.getName().startsWith("normaconstructor:")) {
                        let playerID = gamemode.actor.getUniqueIdBin()
                        let player = Actor.fromUniqueIdBin(playerID)
                        if (player?.isPlayer()) {
                            handlePlayerRequest(
                                {
                                    "requestType": item.getName().slice(item.getName().indexOf(":") + 1),
                                    "playerID": playerID,
                                    "additionalData": assembleUseItemData(
                                        player,
                                        new Position(blockPos.toJSON(), dimensionIdentifier[player.getDimensionId()])
                                    )
                                }
                            )
                        }
                    }
                    return itemUseOn(gamemode, item, blockPos, n, pos, block);
                });

    }
    events.command.on((cmd, origin, ctx) => {
        console.log(cmd, origin)
        const player = ctx.origin.getEntity()
        if (player?.isPlayer() && cmd.startsWith("/nos:")) {
            handlePlayerRequest({ requestType: "run_nos", playerID: player.getUniqueIdBin(), additionalData: { nos: cmd.slice("/nos:".length) } })
            return 0
        }
        return;
    });
    events.blockPlace.on((e) => {
        handlePlayerRequest({
            "requestType": "get_block_type",
            "playerID": e.player.getUniqueIdBin(),
            "additionalData": assembleUseItemData(
                e.player,
                new Position(e.blockPos.toJSON(), dimensionIdentifier[e.player.getDimensionId()])
            )
        })
        return
    })
    const serverSystem = server.registerSystem(0, 0);
    system.inject({
        createRuntime: function (id: string) {
            let user = system.getUser(id);
            return {
                logger: loggerFactory(id)
            };
        }
    })
    serverSystem.initialize = function () {


    }

    function getUser(playerID: string | number) {
        function registerNewUser(playerID: string | number) {
            let user = system.createUser(playerID)
            //TODO:Separate the following initialization process from this function.
            user.session["__requestAdditionalPosition"] = false;
            user.session["__requestAdditionalBlockType"] = false;
            user.session["__requestAdditionalDirection"] = false;
            user.session["__logLevel"] = "verbose";
            user.session["__on"] = true;
            return user;
        }
        return system.hasUser(playerID) ? system.getUser(playerID) : registerNewUser(playerID)
    }

    function handlePlayerRequest({ requestType, playerID, additionalData }: { requestType: string, playerID: string | number, additionalData?: any }) {
        //Debounce.
        const last = lastTimeOfPlayerRequest.get(playerID), now = Date.now()
        lastTimeOfPlayerRequest.set(playerID, now)
        if (last && now - last < 400) return

        let user = getUser(playerID)
        const logger = loggerFactory(playerID)
        logger.logObject("verbose", { requestType, playerID, additionalData })
        switch (requestType) {
            case "get_position":
            case "get_direction":
            case "get_block_type": {
                if (requestType == "get_position" || user.session["__requestAdditionalPosition"]) user.addPosition(additionalData!.position)
                if (requestType == "get_direction" || user.session["__requestAdditionalDirection"]) user.addDirection(additionalData!.direction)
                if (requestType == "get_block_type" || user.session["__requestAdditionalBlockType"]) user.addBlockType(additionalData!.blockType)
                break;
            }
            case "get_air": {
                user.addBlockType(new BlockType("minecraft:air", {}))
                break;
            }
            case "remove_last_position": {
                logger.log("info", "Removing the last position...")
                user.removePosition()
                break;
            }
            case "remove_last_blocktype": {
                logger.log("info", "Removing the last blockType...")
                user.removeBlockType()
                break;
            }
            case "remove_last_direction": {
                logger.log("info", "Removing the last direction...")
                user.removeDirection()
                break;
            }
            case "choose_next_generator": {
                logger.log("info", "Choosing next generator...")
                user.nextGenerator()
                logger.log("debug", "Current generator:")
                logger.logObject("debug", user.getCurrentGeneratorName())
                break;
            }
            case "show_saved_data": {
                //logger.log("info", "Current positionArray:")
                //logger.logObject("info", generatorArray[generatorIndex].positionArray)
                //logger.log("info", "Current blockTypeArray:")
                //logger.logObject("info", generatorArray[generatorIndex].blockTypeArray)
                //logger.log("info", "Current directionArray:")
                //logger.logObject("info", generatorArray[generatorIndex].directionArray)
                logger.log("info", "Current generator name:")
                logger.logObject("info", user.getCurrentGeneratorName())
                logger.log("info", "Current generator state:")
                logger.logObject("info", user.getCurrentState())
                logger.log("info", "Current session:")
                logger.logObject("info", user.session)
                break;
            }
            case "execute": {
                execute(playerID);
                break;
            }
            case "show_menu": {
                //TODO
                let player = Actor.fromUniqueIdBin(playerID as string) as Actor
                const ni = player.getNetworkIdentifier()

                let form = new CustomForm
                let user = getUser(playerID)
                let ui = user.getCurrentUI() ?? []

                form.setTitle(user.getCurrentGeneratorName())
                ui.forEach((e: any) => {
                    switch (e["viewtype"]) {
                        case "text": {
                            // form.addLabel(e.text)
                            form.addComponent(new FormLabel(e.text))
                            break;
                        }
                        case "button":
                        case "checkbox": {
                            let defaultValue = user.getCurrentState()[e.key]
                            let defaultChoice = e.data.findIndex((choice: any) => choice.value == defaultValue)
                            // form.addDropdown(e.text, Array.from(e.data, choice => choice.text), defaultChoice == -1 ? 0 : defaultChoice)
                            form.addComponent(new FormDropdown(e.text, Array.from(e.data, (choice: any) => choice.text), defaultChoice == -1 ? 0 : defaultChoice))
                            break;
                        }
                        case "edittext": {
                            // form.addInput(e.text, "", user.getCurrentState()[e.key])
                            // form.addInput(e.text, `Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString())
                            form.addComponent(new FormInput(e.text, `Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString()))
                            // form.addInput(e.text,`Input number here`, user.getCurrentState()[e.key].toString())

                            break;
                        }
                    }
                });
                form.sendTo(ni, (form) => {
                    console.log(form)
                    if (!(form.response)) return
                    (form.response as number[]).forEach((e, i) => {
                        switch (ui[i]["viewtype"]) {
                            case "text": {
                                break;
                            }
                            case "button":
                            case "checkbox": {
                                user.getCurrentState()[ui[i].key] = ui[i].data[e].value
                                break;
                            }
                            case "edittext": {
                                // form.addInput(e.text, "", user.getCurrentState()[e.key])
                                // form.addInput(e.text,`Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString())
                                user.getCurrentState()[ui[i].key] = e
                                break;
                            }
                        }
                        if (ui[i].hasOwnProperty("dataForUIHandler")) user.UIHandler(ui[i]["dataForUIHandler"])
                    })
                })
                break;
            }
            case "show_meta_menu": {
                let player = Actor.fromUniqueIdBin(playerID as string) as Actor
                const ni = player.getNetworkIdentifier()

                let form = new CustomForm
                form.setTitle("Meta menu")
                form.addComponent(new FormDropdown("Choose generator:", user.getGeneratorNames(), user.getGeneratorNames().findIndex((e: string) => e == user.getCurrentGeneratorName())))
                form.sendTo(ni, (form) => {
                    console.log(form)
                    if (!(form.response)) return
                    user.switchGenerator(form.response[0])
                })
                break;
            }
            case "run_nos": {
                user.runNOS(additionalData.nos, undefined)
                break;
            }
        }
    }

    let compiler = {
        raw: function (blockArray: any[]) {
            return blockArray
        },
        clone: function ({ startCoordinate, endCoordinate, targetCoordinate }: { startCoordinate: Coordinate, endCoordinate: Coordinate, targetCoordinate: Coordinate }) {
            if (startCoordinate.x >= endCoordinate.x) {
                let temp = startCoordinate.x
                startCoordinate.x = endCoordinate.x
                endCoordinate.x = temp
            }
            if (startCoordinate.y >= endCoordinate.y) {
                let temp = startCoordinate.y
                startCoordinate.y = endCoordinate.y
                endCoordinate.y = temp
            }
            if (startCoordinate.z >= endCoordinate.z) {
                let temp = startCoordinate.z
                startCoordinate.z = endCoordinate.z
                endCoordinate.z = temp
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

            return []
        },
        fill: function ({ blockType, startCoordinate, endCoordinate }: { blockType: BlockType, startCoordinate: Coordinate, endCoordinate: Coordinate }) {

            if (startCoordinate.x >= endCoordinate.x) {
                let temp = startCoordinate.x
                startCoordinate.x = endCoordinate.x
                endCoordinate.x = temp
            }
            if (startCoordinate.y >= endCoordinate.y) {
                let temp = startCoordinate.y
                startCoordinate.y = endCoordinate.y
                endCoordinate.y = temp
            }
            if (startCoordinate.z >= endCoordinate.z) {
                let temp = startCoordinate.z
                startCoordinate.z = endCoordinate.z
                endCoordinate.z = temp
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
                [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`, (commandResultData) => { }
                        );

            return []
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
    }
    async function execute(playerID: string | number) {
        let user = getUser(playerID)
        let logger = loggerFactory(playerID);
        logger.log("info", "Start validating parameters...");
        let isVaild = await user.isValidParameter();
        if (isVaild) {
            logger.log("info", "Now Execution started.");

            let buildInstructions = await user.generate();
            if (buildInstructions === undefined) return;

            logger.logObject("verbose", buildInstructions)

            for (let buildInstruction of buildInstructions) {
                //I know it looks silly... "Compatibility reason".
                if (!buildInstruction.hasOwnProperty("type")) setBlock(buildInstruction)
                else {
                    //Another compromise...
                    //'Compliers' don't just complie: the fill() method can be invoked in which block will be placed directly.
                    let blocks = compiler[buildInstruction.type as keyof typeof compiler](buildInstruction.data)
                    for (let block of blocks) setBlock(block)

                }
            }
        }
    }
    function displayObject(object: any, playerID?: undefined) {
        displayChat(JSON.stringify(object, null, '    '), playerID)
    }
    function displayChat(message: string, playerID?: any) {
        if (playerID) {
            let player = Actor.fromUniqueIdBin(playerID)
            if (player && player.isPlayer()) player.sendChat(message, "nc")
            else console.log(message)
        }
        else
            serverSystem.executeCommand(`say ${message}`, () => { })
    }

    function setBlock(block: { blockType: any; position: any; }) {

        //displayChat("§b We all agree, NZ is JULAO!")
        let blockType = block.blockType
        let position = block.position
        let coordinate = position.coordinate
        // STILL thank you, WavePlayz!


        //TODO:
        //It currently use destroy mode to force replace the old block, but will leave tons of items.
        //Might change to set air block first.
        //NEW TODO: UNDERSTANDING WHAT THE FUDGE I WAS TALKING ABOUT HERE.
        serverSystem.executeCommand(`/setblock ${coordinate.x} ${coordinate.y} ${coordinate.z} ${blockType.blockIdentifier.slice(blockType.blockIdentifier.indexOf(":") + 1)} [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`, (commandResultData) => {

        });
    }
    function loggerFactory(playerID: string | number) {
        return {
            displayChat, displayObject,
            log: function (level: string, message: string) {
                const colorMap = new Map([
                    ["verbose", { num: 0, color: "§a" }],
                    ["debug", { num: 1, color: "§6" }],
                    ["info", { num: 2, color: "§b" }],
                    ["warning", { num: 3, color: "§e" }],
                    ["error", { num: 4, color: "§c" }],
                    ["fatal", { num: 5, color: "§4" }]
                ])
                const user = getUser(playerID)
                if (colorMap.get(level)!.num >= colorMap.get(user.session["__logLevel"])!.num)
                    this.displayChat(colorMap.get(level)!.color + "[" + level + "]" + message, playerID)
            },
            logObject: function (level: any, object: any) {
                this.log(level, JSON.stringify(object, null, '    '))
            }
        }
    }



})()
