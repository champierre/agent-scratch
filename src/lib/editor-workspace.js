// エディタ(Blockly)のメインワークスペースを取得する。
//
// なぜ React fiber 経由なのか:
// - @scratch/scratch-gui は prebuilt の dist(dist/scratch-gui.js)として読み込まれ、
//   その中に独自の scratch-blocks(Blockly)インスタンスを内包している。
// - そのため、アプリ側から `import * as ScratchBlocks from 'scratch-blocks'` しても
//   別インスタンスになり、`ScratchBlocks.getMainWorkspace()` は null を返す
//   (エディタの workspace は scratch-gui 内部のインスタンスに登録されているため)。
// - GUI 側はワークスペースを props/コールバックで外部に公開していない。
// そこで、Blockly が生成する DOM(.injectionDiv など)から React fiber をたどり、
// `this.workspace` を持つ scratch-gui の Blocks コンポーネント実体を見つけて返す。
//
// 取得できない場合(エディタ未マウント等)は null を返す。呼び出し側は
// 「取得できなければ何もしない」前提でガードすること。
export const getEditorWorkspace = () => {
    if (typeof document === 'undefined') return null;
    // Blockly が生成する要素を起点にする(クラス名は Blockly 由来で安定)
    const anchors = document.querySelectorAll('.injectionDiv, .blocklyWorkspace, .blocklySvg');
    for (const anchor of anchors) {
        // 起点要素から上方向に React fiber を持つ要素を探す
        let node = anchor;
        let fiber = null;
        while (node && !fiber) {
            for (const key in node) {
                if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
                    fiber = node[key];
                    break;
                }
            }
            node = node.parentElement;
        }
        // fiber.return をたどり、メインワークスペース(toolbox を持つ)を握る
        // コンポーネント実体(stateNode.workspace)を探す
        let f = fiber;
        let guard = 0;
        while (f && guard < 400) {
            guard++;
            const sn = f.stateNode;
            if (sn && sn.workspace &&
                typeof sn.workspace.getToolbox === 'function' &&
                sn.workspace.getToolbox()) {
                return sn.workspace;
            }
            f = f.return;
        }
    }
    return null;
};
