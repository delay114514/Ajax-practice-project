/*本项目所有的请求均由fetch API执行，所有请求都为post请求，天气数据来源高德开放平台 天气API*/


const key="your-key";
const Pekingcity=`110101`
const extensions_all=`all`
const extensions_base="base"

const keywords = {"多云":"cloudy", "晴":"sunny","阴":"overcast", "雪":"snowy","雨":"rainy" , "雾":"haze","霾":"haze", "尘":"sandstorm","沙":"sandstorm","风":"windy"};//天气关键词中英文映射对象
const week2day ={"today":"今天","tomorrow":"明天","dayaftertomorrow":"后天","threedaysformnow":"大后天"};//日期中英文映射对象
const week=Object.keys(week2day);

let govdata=[];//临时地理数据存储对象

let weatherbase;
let weatherall;



const mainbox=document.getElementById("Weather-box-main");//实况天气预报div元素
const dialog_of_informa=document.getElementById("information-dialog");//对话框元素
const locationtext=document.getElementById("location-p");//位置图标后的文本元素
const dialog_of_search= document.getElementById("search-dialog");//搜索结果对话框
const searchform=document.getElementById("search-form");//搜索结果表单
const searchbox=document.getElementById("searchbox");//搜索框

let selectedValue=[];//搜索结果返回值存放的数值变量

let date=new Date();//日期对象
let month=parseInt(date.getMonth());
let hour= parseInt(date.getHours());
let day= parseInt(date.getDate());

//三个判断时间区段函数（分界点就是每日API天气预报更新数据的时间）
const isNight = h => h < 8 || h > 18;
const isMorning = h => h >= 8 && h < 11;
const isAfternoon = h => h >= 11 && h < 18;

let previoushour= parseInt(window.localStorage.getItem("previoushour"));
let previousday=parseInt(window.localStorage.getItem("previousday"));
let previousmonth=parseInt(window.localStorage.getItem("previousmonth"));

let shouldRefresh = Boolean(month !== previousmonth ||previousday !== day ||
      (isNight(previoushour) && isMorning(hour)) ||
      (isMorning(previoushour) && isAfternoon(hour)) ||
      (isAfternoon(previoushour) && isNight(hour)));//判断变量，检测是否需要更新天气预报数据


const getIPurl=`https://ip.useragentinfo.com/json?`//IP定位接口





function debounce(fun,time)//防抖函数
  {
    let timer;
    return function(...args)
    {
      if(timer) clearTimeout(timer);
      timer = setTimeout(()=>fun(this.args),time);
    }
    
  }

// 延迟函数(防止单秒内请求过多)
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//获得省级行政区域数据函数
  async function fetchProvinceData() {
    const Provinceurl=`https://restapi.amap.com/v3/config/district?keywords=中国&subdistrict=1&key=${key}&extensions=${extensions_base}`
    try {
      const response = await fetch(Provinceurl);
      if (!response.ok) throw new Error("请求失败");
      const data = await response.json();
      console.log("省级数据:", data);
      data.districts[0]?.districts.forEach(element => {
        govdata.push({ adcode:element.adcode, provinces: element.name, city:[],level:"provice"});
      });
    } catch (error) {
      console.error("请求失败:", error);
    }
  }
  

 //获得市级行政区域数据函数 
async function fetchCityData() {
      let provinces;
      
      for (i=0;i<govdata.length;i++)
        {
          provinces = govdata[i].provinces;
          if(provinces==="台湾省")
            continue;
          else if (
            provinces === "北京市" ||
            provinces === "澳门特别行政区" ||
            provinces === "香港特别行政区" ||
            provinces === "天津市" ||
            provinces === "上海市" ||
            provinces === "重庆市"
          )
          {
            govdata[i].city.push({city:provinces,county:[],level:"city",parent:`${govdata[i].provinces}`});
            continue;
          }
            
          const Cityurl = `https://restapi.amap.com/v3/config/district?keywords=${provinces}&subdistrict=1&key=${key}&extensions=${extensions_base}`;
            try {
              console.log(Cityurl);
            const response = await fetch(Cityurl);
            if (!response.ok) throw new Error("请求失败");
            const data = await response.json();
            console.log("城市数据:", data);
            data.districts[0].districts.forEach(element => {
              govdata[i].city.push({ adcode:element.adcode, city: element.name, county:[],level:"city",parent:`${govdata[i].provinces}`});
            });
            } catch (error) {
            console.error("请求失败:", error);
            }
            await delay(500);
        };     
}

//获得区县或者街道、村行政区(部分城市无区县级行政区)域数据
async function fetchCountyData() {
  for (i=0;i<govdata.length;i++)
    {
      if(govdata[i].provinces==="台湾省")
        continue;
      for(j=0;j<govdata[i].city.length;j++)
      {
        const CountyorStreetsurl = `https://restapi.amap.com/v3/config/district?keywords=${govdata[i].city[j].city}&subdistrict=1&key=${key}&extensions=${extensions_base}`;
        try {
        console.log(CountyorStreetsurl);
        const response = await fetch(CountyorStreetsurl);
        if (!response.ok) throw new Error("请求失败");
        const data = await response.json();
        console.log("县区数据:", data);
        data.districts[0].districts.forEach(element => {
        govdata[i].city[j].county.push({ adcode:element.adcode, countyorstreets: element.name,level:"county",parent:`${govdata[i].city[j].city}`});
        });
        } catch (error) {
        console.error("请求失败:", error);
        }
        await delay(500);
      }
    };     
}


  


  //根据搜索框内容内容得到内容及处理函数（仅含市级和区县级行政区域的查询）
  function GetSearchResult(searchvalue){
    searchvalue=searchvalue.trim();
    if(searchvalue===null||searchvalue==="") return;//空值自动返回
    if(searchvalue.includes(" "))//带空格不能通过搜索
      {
        alert("请勿输入空格")
        return;
      }
    else if(govdata===null)
    {
        alert("数据出错，请稍后再试")
        return;
    }
    if(/[a-zA-Z]/.test(searchvalue))
    {
      alert("暂不支持拼音或英文检索");
      return;
    }
    if(/[\uFF00-\uFFFF]/.test(searchvalue)||/[\u0000-\u00FF]/.test(searchvalue)||
    /[\u3002\uff1b\uff0c\uff1a\u201c\u201d\uff08\uff09\u3001\uff1f\u300a\u300b\u2018\u2019\u2014\u3011\u3010\u2026\u2026]/.test(searchvalue))
    {
      alert("请勿输入符号");
      return;
    }
    searchform.innerHTML="";//每次搜索前清空搜索对话框内容
    for (i=0;i<govdata.length;i++)
      {
        for(j=0;j<govdata[i].city.length;j++)
        {
            if(govdata[i].city[j].city.includes(searchvalue))
            {//动态插入搜索结果  
              searchform.insertAdjacentHTML("beforeend",
                `<button class="search-result" value="${govdata[i].city[j].adcode},${govdata[i].city[j].city}">
                ${govdata[i].city[j].city}———
                ${govdata[i].city[j].parent}</button>
                <hr>`)
            }
            for(k=0;k<govdata[i].city[j].county.length;k++)
            {
              if(govdata[i].city[j].county[k].countyorstreets.includes(searchvalue))
                {
                  searchform.insertAdjacentHTML("beforeend",
                    `<button class="search-result" value="${govdata[i].city[j].county[k].adcode},${govdata[i].city[j].county[k].countyorstreets}">
                    ${govdata[i].city[j].county[k].countyorstreets}———
                    ${govdata[i].city[j].county[k].parent}</button>
                    <hr>`)
                }
            }
        }
      }
    if(searchform.childNodes.length===0)
      {
        searchform.innerHTML=`<h2>不存在你输入的城市，请查阅后再输入</h2>`;
        dialog_of_search.show();
      }
    else
    {
        dialog_of_search.show();
        document.querySelectorAll('.search-result').forEach(element=>element.addEventListener('click',function()
        {//为搜索结果的html按钮添加事件监听，点击后返回相应行政编码和行政区域名 
          // 获取按钮值
          selectedValue = this.value.split(",");
          console.log(selectedValue);
          locationtext.innerText=selectedValue[1];//设置当前选定区域的文本
        }))
    }
}


//处理搜索值函数
  async function HandleSerarchResult(searchvalue){
      if(searchvalue===null||searchvalue==="")
          return;
      area=searchvalue;
      console.log(searchvalue);
      dialog_of_informa.innerHTML='<h1>数据正根据搜索结果改变</h1>'
      dialog_of_informa.showModal();
      weatherbase=await GetWeatherBase(area);
      weatherall=await GetWeatherAll(area);
      writemaindate(weatherbase,weatherall);
      writeforecastdate(weatherall);
      dialog_of_informa.innerHTML='<h1>数据准备完毕</h1>';
      setTimeout(()=>dialog_of_informa.close(),1000);
  }

  //API调用获取IP信息函数（备选函数）
  async function GetIP() {
    try{
      const response =await fetch(getIPurl);
      if(!response.ok) throw new Error("请求失败");
      const data = await response.json();
      console.log(data);
      return data;
   }
   catch(error){
    console.error("请求失败:",error);
    return null;
   } 
  }

  //API调用根据输入文字得到相应地理信息函数（备选函数）
  async function GetAddresslocation(address) {
    try{
      const Getadressurl=`https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${address}`
      const response =await fetch(Getadressurl);
      if(!response.ok) throw new Error("请求失败");
      const data = await response.json();
      console.log(data);
      return data.geocodes[0].adcode;
   }
   catch(error){
    console.error("请求失败:",error);
    return null;
   } 
  }

//IP信息得到地理位置函数（备选函数）
  async function GetIPlocation() {
    let useripjson=await GetIP();
    if(!useripjson) locationtext.innerText="北京市";
    else
    {
    locationtext.innerText=useripjson.city;
    }
    let location=useripjson.city+useripjson.area;
    console.log(location);
    let adcode=await GetAddresslocation(location);
    return adcode;
  }


//根据HTML5 Geolocation API得到地理经纬度信息函数  
function GetlocationbyAPI()
{
  return new Promise((resolve, reject) => {//因为getCurrentPosition实质上是异步操作，因此为保证代码执行顺序，应返回Promise对象
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const geodata = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          resolve(geodata); // 返回解析后的地理位置数据
        },
        error => {
          console.error(`错误代码 ${error.code}: ${error.message}`);
          reject(error); // 返回错误
        }
      );
    } else {
      
      reject(new Error("浏览器不支持地理定位")); // 明确拒绝
    
    }
  })
}

//api调用根据经纬度得到确切地理地址信息
    async function GetGeolocation(longitude, latitude) {
          const GeoTransurl = `https://restapi.amap.com/v3/geocode/regeo?key=${key}&location=${longitude},${latitude}`;
          
          try {
            const response = await fetch(GeoTransurl);
            if (!response.ok) throw new Error(`HTTP 错误! 状态码: ${response.status}`);
            
            const result = await response.json();
            
            // 校验 API 返回状态码
            if (result.status !== "1") {
              console.error("API 返回失败:", result.info || "未知错误");
              alert("出现网络错误，工程师正在抢救中");
              return null;
            }
            
            // 安全访问嵌套属性（可选链操作符）
            locationtext.innerText=result.regeocode?.addressComponent?.district;
            const adcode = result.regeocode?.addressComponent?.adcode;
            if (adcode) {
              console.log("成功获取 adcode:", adcode);
              return adcode;
            } else {
              console.error("adcode 字段缺失");
              alert("出现网络错误，工程师正在抢救中");
              return null;
            }
            
          } catch (error) {
            console.error("请求失败:", error);
            alert("出现网络错误，工程师正在抢救中");
            return null;
          }
    }

//api调用拿取当前天气实况数据函数
  async function GetWeatherBase(area) {
    let weatherurl_base;
    if(area)
    {
      weatherurl_base=`https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${area}&extensions=${extensions_base}`;
    }
    else
    {
      alert("输入位置数值错误,请查阅后再输入")
          return;
    }
    try{
      const response =await fetch(weatherurl_base);
      if(!response.ok) throw new Error("请求失败");
      const data = await response.json();
      console.log(data);
      return data;
   }
   catch(error){
    console.error("请求失败:",error);
    alert("数据错误，工程师正在抢救中");
    return null;
   } 
  }


  //api调用拿取天气预报数据函数
  async function GetWeatherAll(area) {
    let weatherurl_all;
  
    if(window.localStorage.getItem("reallocation")!==area||shouldRefresh) 
    {
      if(area)
        {
          weatherurl_all=`https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${area}&extensions=${extensions_all}`;
        }
        else
        {
          alert("输入位置数值错误,请查阅后再输入")
          return;
        }
      try{
      const response =await fetch(weatherurl_all);
      if(!response.ok) throw new Error("请求失败");
      const data = await response.json();
      console.log(data);
      window.localStorage.setItem(`${area}天气预报`,JSON.stringify(data));
      return data;
      }
      catch(error){
      console.error("请求失败:",error);
      alert("数据错误，工程师正在抢救中");
      return null;
      }
    }
    else
    {
      //window.localStorage.setItem("previousarea",area);
      return JSON.parse(window.localStorage.getItem(`${area}天气预报`));
    }
  }



// 辅助函数：标准化天气关键字并返回对应图片地址(相对)
function normalizeWeather(weatherText) {
  const lowerText = weatherText.toLowerCase();
  let normalword = Object.keys(keywords).find(value => lowerText.includes(value));
  if(normalword===("尘"||"沙"))
  {
    normalword="沙尘";
  }
  return "image/"+normalword+".jpg" || "default";
}

// 辅助函数：安全设置背景图片
function setBackgroundImage(element, imagePath) {
  const testImg = new Image();
  testImg.onerror = () => {
      console.error(`背景图片加载失败: ${imagePath}`);
      element.style.backgroundImage = `url(image/${weatherBackgroundMap.default})`;
  };
  testImg.src = imagePath||null;
  testImg.onload = () => {
      element.style.backgroundImage = `url(${imagePath})`;
      element.style.backgroundSize = "cover";
      element.style.backgroundPosition = "center";
      element.style.transition = "background-image 0.5s ease-in-out";
  };
  
}


  /*输出实时天气框内容*/
function writemaindate(weatherbase,weatherall)
{
  const body=document.body;
  const weatherjpgurl=normalizeWeather(weatherbase.lives[0].weather); 
  setBackgroundImage(body,weatherjpgurl);
                    
  const reporttime=document.getElementById("reporttime");
  reporttime.innerText=`当前预报时间:${weatherbase.lives[0].reporttime}`
  const newhtml=`
                  <h1 class="comonfontsetting">${weatherbase.lives[0].temperature}℃</h1>
                  <h2 class="comonfontsetting">${weatherall.forecasts[0].casts[0].daytemp}℃/${weatherall.forecasts[0].casts[0].nighttemp}℃</h2>
                  <h2 class="comonfontsetting">${weatherbase.lives[0].weather} 湿度${weatherbase.lives[0].humidity}%</h2>
                  <h2 class="comonfontsetting">风向：${weatherbase.lives[0].winddirection} </h2>
                  <h2 class="comonfontsetting">风力：${weatherbase.lives[0].windpower}</h2>
                `
  mainbox.innerHTML=newhtml;
}




//根据给定天气预报数据进行HTML代码写入的函数
function writedatebyday(day,index)
{
  let weeks=week[index];
  let box_of_day=document.getElementById(weeks);
  let datehtml=`<div class="Weather-box-secondary">
    <h3 class="comonfontsetting_s">${week2day[weeks]}</h3>
    <h3 class="comonfontsetting_s">${day.date}</h3>
    <h2 class="comonfontsetting_s">${day.nighttemp}-${day.daytemp}℃</h2>
    <img class="Weather-picture" src="image/${keywords[Object.keys(keywords).find(value => day.dayweather.includes(value))]}.jpg">
    <h3 class="comonfontsetting_s">${day.dayweather}</h3>
    <h3 class="comonfontsetting_s">风向：${day.daywind} </h3>
    </div>`
  box_of_day.innerHTML=datehtml;
}

//获取天气预报数据中单独每天json对象并调用写入函数的函数
function writeforecastdate(weatherall)
{
    const today=weatherall.forecasts[0].casts[0];
    const tomorrow=weatherall.forecasts[0].casts[1];
    const dayaftertomorrow=weatherall.forecasts[0].casts[2];
    const threedaysformnow=weatherall.forecasts[0].casts[3];
    let index=0;//天数索引,0即当天
    writedatebyday(today,index++);
    writedatebyday(tomorrow,index++);
    writedatebyday(dayaftertomorrow,index++);
    writedatebyday(threedaysformnow,index);
}
            
//主函数
  async function main() {
    searchbox.disabled = true;


    govdata=JSON.parse(window.localStorage.getItem("govdata"));//拿取缓存的行政区划数据
    if(govdata===null)
    {
      dialog_of_informa.innerHTML='<h1>第一次登录网页，正在缓存行政区划数据，请稍后</h1>';
      dialog_of_informa.showModal();
        govdata=[];
        await fetchProvinceData();
        await fetchCityData();
        await fetchCountyData();
        window.localStorage.setItem("govdata",JSON.stringify(govdata));
      dialog_of_informa.close();
    }
     console.log("处理后的行政区划数据:", govdata);
    
    
     let geodata;//地理数据变量(经纬度)
    let area;//行政编码变量


     try{
      dialog_of_informa.innerHTML="<h1>正在获取和更新数据,请稍后</h1>";
      geodata=await GetlocationbyAPI();
      area=await GetGeolocation(geodata.longitude,geodata.latitude);
      dialog_of_informa.showModal();
     }
     catch
     {
      alert("浏览器不支持或你拒绝地理定位,将自动切换为ip定位");
      area=await GetIPlocation();//此处备用不推荐使用，可能存在行政区域重名的可能，导致结果异常
     }
     window.localStorage.setItem("reallocation",area);
    weatherbase=await GetWeatherBase(area);
    weatherall=await GetWeatherAll(area);
    writemaindate(weatherbase,weatherall);
    writeforecastdate(weatherall);
    dialog_of_informa.innerHTML='<h1>数据准备完毕</h1>';
    setTimeout(()=>dialog_of_informa.close(),2000);
    searchbox.disabled = false;//数据备好前禁用输入框
    searchbox.addEventListener("input",debounce(() => GetSearchResult(searchbox.value), 2500));//事件绑定获取输入框内容并处理
    searchbox.addEventListener('click',()=>dialog_of_search.close());
    searchform.addEventListener("submit",()=>HandleSerarchResult(selectedValue[0]));
    window.localStorage.setItem("previoushour",hour);//设置上次访问小时
    window.localStorage.setItem("previousday",day);//设置上次访问日期
    window.localStorage.setItem("previousmonth",month);//设置上次访问月份
  }
 window.addEventListener("DOMContentLoaded",()=>main());//打开网页自动触发主函数
  
