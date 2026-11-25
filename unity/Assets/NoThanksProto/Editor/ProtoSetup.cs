using System;
using System.IO;
using System.Text;
using NoThanks.Proto;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UIElements;

namespace NoThanks.ProtoEditor
{
    /// <summary>
    /// 씬·설정 자산을 손으로 쓴 YAML 대신 에디터 메뉴로 생성한다.
    /// 메뉴: Tools ▸ NoThanks Proto ▸ (0) 전체 실행 / (1) 프로젝트 설정 / (2) 씬 생성 / (3) Web 빌드
    /// 배치 모드: Unity -batchmode -quit -projectPath unity -executeMethod NoThanks.ProtoEditor.ProtoSetup.CommandLineAll
    /// </summary>
    public static class ProtoSetup
    {
        private const string Root = "Assets/NoThanksProto";
        private const string Gen = Root + "/Generated";
        private const string ScenePath = Root + "/Scenes/Main.unity";
        private const string ThemePath = Root + "/UI/NoThanksTheme.tss";
        private const string UrpMaterials = "Packages/com.unity.render-pipelines.universal/Runtime/Materials/";
        public const string WebBuildDir = "WebBuild";

        [MenuItem("Tools/NoThanks Proto/0. 전체 실행 (설정 → 씬 생성)", priority = 0)]
        public static void SetupAll()
        {
            SetupProject();
            BuildScene();
        }

        // ------------------------------------------------------------------
        // 1. 프로젝트 설정
        // ------------------------------------------------------------------
        [MenuItem("Tools/NoThanks Proto/1. 프로젝트 설정 (URP 2D · Web)", priority = 1)]
        public static void SetupProject()
        {
            EnsureFolder(Gen);

            // URP 2D 렌더러 + 파이프라인 에셋
            var rdPath = Gen + "/URP-2D-Renderer.asset";
            var rd = AssetDatabase.LoadAssetAtPath<Renderer2DData>(rdPath);
            if (rd == null)
            {
                rd = ScriptableObject.CreateInstance<Renderer2DData>();
                AssetDatabase.CreateAsset(rd, rdPath);
            }
            var urpPath = Gen + "/URP-Asset.asset";
            var urp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(urpPath);
            if (urp == null)
            {
                urp = UniversalRenderPipelineAsset.Create(rd);
                AssetDatabase.CreateAsset(urp, urpPath);
            }
            urp.supportsHDR = true; // 블룸용 HDR
            EditorUtility.SetDirty(urp);
            EditorUtility.SetDirty(rd);

            GraphicsSettings.defaultRenderPipeline = urp;
            int current = QualitySettings.GetQualityLevel();
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = urp;
            }
            QualitySettings.SetQualityLevel(current, false);

            // 플레이어 설정 (Web)
            PlayerSettings.companyName = "Prototype";
            PlayerSettings.productName = Brand.Name;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.runInBackground = true;
            PlayerSettings.WebGL.template = "PROJECT:NoThanksProto";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Brotli;
            PlayerSettings.WebGL.decompressionFallback = true; // 일반 정적 서버(python http.server)에서도 열리도록
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.WebGL, ManagedStrippingLevel.Medium);

            // 입력: 레거시 전용이면 Both 로 (새 Input System 사용). 바뀌면 에디터 재시작 필요.
            TrySetActiveInputHandler();

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("[NoThanksProto] 프로젝트 설정 완료: URP 2D 렌더러, HDR, Linear, Web(Brotli+fallback), 템플릿 NoThanksProto");
        }

        private static void TrySetActiveInputHandler()
        {
            try
            {
                var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
                if (assets == null || assets.Length == 0) return;
                var so = new SerializedObject(assets[0]);
                var prop = so.FindProperty("activeInputHandler");
                if (prop != null && prop.intValue == 0)
                {
                    prop.intValue = 2; // Both
                    so.ApplyModifiedProperties();
                    Debug.Log("[NoThanksProto] Active Input Handling → Both. 에디터를 재시작하면 적용됩니다.");
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("[NoThanksProto] 입력 설정 변경 실패(수동으로 Player ▸ Active Input Handling 확인): " + e.Message);
            }
        }

        // ------------------------------------------------------------------
        // 2. 씬 생성
        // ------------------------------------------------------------------
        [MenuItem("Tools/NoThanks Proto/2. 씬 생성 (Build Scene)", priority = 2)]
        public static void BuildScene()
        {
            if (GraphicsSettings.defaultRenderPipeline == null)
            {
                Debug.LogWarning("[NoThanksProto] URP 가 설정되지 않아 먼저 프로젝트 설정을 실행합니다.");
                SetupProject();
            }
            EnsureFolder(Root + "/Scenes");
            EnsureFolder(Gen);

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 카메라 (직교, 포스트프로세싱 ON)
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camGo.transform.position = new Vector3(0, 0, -10);
            var cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 5;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Pal.Ink;
            cam.allowHDR = true;
            var camData = cam.GetUniversalAdditionalCameraData();
            camData.renderPostProcessing = true;
            camGo.AddComponent<AudioListener>();

            // 2D 라이트
            var lightsRoot = new GameObject("Lights");
            var global = NewLight(lightsRoot.transform, "Global Light 2D", Light2D.LightType.Global, new Color(1f, 0.93f, 0.86f), 0.42f, Vector3.zero);
            var lamp = NewLight(lightsRoot.transform, "Pendant Lamp", Light2D.LightType.Point, new Color(1f, 0.84f, 0.6f), 1.05f, new Vector3(0, 0.6f, 0));
            lamp.pointLightOuterRadius = 7f;
            lamp.pointLightInnerRadius = 0.8f;
            lamp.falloffIntensity = 0.65f;
            var accent = NewLight(lightsRoot.transform, "Turn Accent", Light2D.LightType.Point, Pal.BrassLight, 0.55f, new Vector3(0, -3f, 0));
            accent.pointLightOuterRadius = 3.2f;
            accent.pointLightInnerRadius = 0.2f;
            accent.falloffIntensity = 0.8f;

            // 포스트프로세싱 볼륨 (Bloom, Vignette, Tonemapping, Color Adjustments)
            var profile = BuildVolumeProfile(Gen + "/TableVolume.asset");
            var volGo = new GameObject("Global Volume");
            var vol = volGo.AddComponent<Volume>();
            vol.isGlobal = true;
            vol.priority = 1;
            vol.sharedProfile = profile;

            // 테이블 연출
            var fxGo = new GameObject("TableFx");
            var fx = fxGo.AddComponent<TableFx>();
            fx.Cam = cam;
            fx.GlobalLight = global;
            fx.Lamp = lamp;
            fx.Accent = accent;
            fx.LitSpriteMaterial = LoadUrpMaterial("Sprite-Lit-Default.mat", "Universal Render Pipeline/2D/Sprite-Lit-Default", "SpriteLit");
            fx.UnlitSpriteMaterial = LoadUrpMaterial("Sprite-Unlit-Default.mat", "Universal Render Pipeline/2D/Sprite-Unlit-Default", "SpriteUnlit");

            // UI Toolkit 문서 + 앱
            var panel = BuildPanelSettings(Gen + "/PanelSettings.asset");
            var appGo = new GameObject("App");
            var doc = appGo.AddComponent<UIDocument>();
            doc.panelSettings = panel;
            var app = appGo.AddComponent<App>();
            app.PanelSettings = panel;
            app.Fx = fx;

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("[NoThanksProto] 씬 생성 완료: " + ScenePath + " (Play 버튼으로 실행)");
        }

        private static Light2D NewLight(Transform parent, string name, Light2D.LightType type, Color color, float intensity, Vector3 pos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            var l = go.AddComponent<Light2D>();
            l.lightType = type;
            l.color = color;
            l.intensity = intensity;
            return l;
        }

        private static Material LoadUrpMaterial(string file, string shaderName, string fallbackName)
        {
            var m = AssetDatabase.LoadAssetAtPath<Material>(UrpMaterials + file);
            if (m != null) return m;
            var path = Gen + "/" + fallbackName + ".mat";
            m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m != null) return m;
            var shader = Shader.Find(shaderName);
            if (shader == null)
            {
                Debug.LogWarning("[NoThanksProto] 셰이더를 찾지 못함: " + shaderName);
                return null;
            }
            m = new Material(shader);
            AssetDatabase.CreateAsset(m, path);
            return m;
        }

        private static VolumeProfile BuildVolumeProfile(string path)
        {
            var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(path);
            if (profile == null)
            {
                profile = ScriptableObject.CreateInstance<VolumeProfile>();
                AssetDatabase.CreateAsset(profile, path);
            }

            Bloom bloom;
            if (!profile.TryGet(out bloom)) { bloom = profile.Add<Bloom>(true); AssetDatabase.AddObjectToAsset(bloom, profile); }
            bloom.threshold.Override(0.85f);
            bloom.intensity.Override(1.15f);
            bloom.scatter.Override(0.7f);
            bloom.tint.Override(new Color(1f, 0.9f, 0.75f));

            Vignette vig;
            if (!profile.TryGet(out vig)) { vig = profile.Add<Vignette>(true); AssetDatabase.AddObjectToAsset(vig, profile); }
            vig.color.Override(Color.black);
            vig.intensity.Override(0.36f);
            vig.smoothness.Override(0.5f);

            Tonemapping tm;
            if (!profile.TryGet(out tm)) { tm = profile.Add<Tonemapping>(true); AssetDatabase.AddObjectToAsset(tm, profile); }
            tm.mode.Override(TonemappingMode.Neutral);

            ColorAdjustments ca;
            if (!profile.TryGet(out ca)) { ca = profile.Add<ColorAdjustments>(true); AssetDatabase.AddObjectToAsset(ca, profile); }
            ca.postExposure.Override(0.15f);
            ca.contrast.Override(10f);
            ca.saturation.Override(-6f);

            EditorUtility.SetDirty(profile);
            AssetDatabase.SaveAssets();
            return profile;
        }

        private static PanelSettings BuildPanelSettings(string path)
        {
            var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(path);
            if (panel == null)
            {
                panel = ScriptableObject.CreateInstance<PanelSettings>();
                AssetDatabase.CreateAsset(panel, path);
            }
            var theme = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(ThemePath);
            if (theme != null) panel.themeStyleSheet = theme;
            else Debug.LogWarning("[NoThanksProto] 런타임 테마를 찾지 못함: " + ThemePath);
            panel.scaleMode = PanelScaleMode.ConstantPixelSize;
            panel.scale = 1f; // 실행 시 App 이 DPR 로 바꾼다
            EditorUtility.SetDirty(panel);
            return panel;
        }

        // ------------------------------------------------------------------
        // 3. Web 빌드
        // ------------------------------------------------------------------
        [MenuItem("Tools/NoThanks Proto/3. Web 빌드 (WebBuild 폴더)", priority = 3)]
        public static void BuildWeb()
        {
            if (!File.Exists(ScenePath)) BuildScene();
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL)
                EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.WebGL, BuildTarget.WebGL);

            var opts = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = WebBuildDir,
                target = BuildTarget.WebGL,
                options = BuildOptions.None,
            };
            var report = BuildPipeline.BuildPlayer(opts);
            var sum = report.summary;

            long buildBytes = DirSize(Path.Combine(WebBuildDir, "Build"));
            long totalBytes = DirSize(WebBuildDir);
            var sb = new StringBuilder();
            sb.AppendLine("결과: " + sum.result);
            sb.AppendLine("Unity: " + Application.unityVersion);
            sb.AppendLine("빌드 시간: " + sum.totalTime);
            sb.AppendLine("Build/ 폴더 (압축된 다운로드 크기): " + Mb(buildBytes));
            sb.AppendLine("WebBuild 전체: " + Mb(totalBytes));
            if (Directory.Exists(Path.Combine(WebBuildDir, "Build")))
            {
                foreach (var f in Directory.GetFiles(Path.Combine(WebBuildDir, "Build")))
                    sb.AppendLine("  " + Path.GetFileName(f) + "  " + Mb(new FileInfo(f).Length));
            }
            sb.AppendLine("압축: " + PlayerSettings.WebGL.compressionFormat + " (decompressionFallback=" + PlayerSettings.WebGL.decompressionFallback + ")");
            if (sum.result == BuildResult.Succeeded) File.WriteAllText(Path.Combine(WebBuildDir, "build-report.txt"), sb.ToString());
            Debug.Log("[NoThanksProto] Web 빌드\n" + sb);
            if (sum.result == BuildResult.Succeeded && !Application.isBatchMode) EditorUtility.RevealInFinder(Path.Combine(WebBuildDir, "index.html"));
        }

        /// <summary>배치 모드용: 설정 → 씬 → Web 빌드.</summary>
        public static void CommandLineAll()
        {
            SetupProject();
            BuildScene();
            BuildWeb();
        }

        // ------------------------------------------------------------------
        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var parent = Path.GetDirectoryName(path).Replace('\\', '/');
            var name = Path.GetFileName(path);
            if (!AssetDatabase.IsValidFolder(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, name);
        }

        private static long DirSize(string dir)
        {
            if (!Directory.Exists(dir)) return 0;
            long s = 0;
            foreach (var f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories)) s += new FileInfo(f).Length;
            return s;
        }

        private static string Mb(long bytes)
        {
            return (bytes / 1024f / 1024f).ToString("0.00") + " MB";
        }
    }
}
